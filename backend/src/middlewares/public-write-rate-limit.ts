import type { Core } from '@strapi/strapi';
import { createHash } from 'node:crypto';

type Action = 'createIdea' | 'vote' | 'comment';
type RateBucket = { count: number; resetAt: number };
type RateLimitConfig = { max: number; windowMs: number };

type KoaContext = {
  request: {
    method?: string;
    path?: string;
    body?: unknown;
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
  };
  status: number;
  body: unknown;
  set: (field: string, value: string) => void;
  ip?: string;
};

const RATE_LIMITS: Record<Action, RateLimitConfig> = {
  createIdea: { max: 5, windowMs: 10 * 60 * 1000 },
  vote: { max: 20, windowMs: 10 * 60 * 1000 },
  comment: { max: 10, windowMs: 5 * 60 * 1000 },
};

const rateBuckets = new Map<string, RateBucket>();

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const getHeaderValue = (ctx: KoaContext, headerName: string): string => {
  const header = ctx.request.headers?.[headerName];
  if (Array.isArray(header)) return header[0] ?? '';
  return typeof header === 'string' ? header : '';
};

const getClientIp = (ctx: KoaContext): string => {
  const forwardedFor = getHeaderValue(ctx, 'x-forwarded-for');
  const forwardedIp = forwardedFor.split(',')[0]?.trim();
  const fallbackIp = ctx.request.ip ?? ctx.ip;
  return forwardedIp || (fallbackIp ? String(fallbackIp) : 'unknown');
};

const getActorIdentity = (ctx: KoaContext): string => {
  const body = asObject(ctx.request.body);
  const actorId = asString(getHeaderValue(ctx, 'x-actor-id')) || asString(getHeaderValue(ctx, 'x-user-id'));
  const actorToken = asString(getHeaderValue(ctx, 'x-actor-token'));
  const fingerprint = asString(body.userFingerprint);

  if (actorId) {
    return `actor:${actorId}`;
  }

  if (actorToken) {
    const tokenHash = createHash('sha256').update(actorToken).digest('hex').slice(0, 24);
    return `token:${tokenHash}`;
  }

  if (fingerprint) {
    return `fingerprint:${fingerprint}`;
  }

  return 'anonymous';
};

const resolveAction = (method: string, path: string): Action | null => {
  if (method === 'POST') {
    if (/^\/api\/public\/ideas\/?$/.test(path)) return 'createIdea';
    if (/^\/api\/public\/ideas\/\d+\/vote\/?$/.test(path)) return 'vote';
    if (/^\/api\/public\/ideas\/\d+\/comments\/?$/.test(path)) return 'comment';
    if (/^\/api\/public\/roadmap\/\d+\/vote\/?$/.test(path)) return 'vote';
    if (/^\/api\/public\/roadmap\/\d+\/comments\/?$/.test(path)) return 'comment';
  }

  if (method === 'DELETE') {
    if (/^\/api\/public\/ideas\/\d+\/vote\/?$/.test(path)) return 'vote';
    if (/^\/api\/public\/roadmap\/\d+\/vote\/?$/.test(path)) return 'vote';
  }

  return null;
};

const pruneRateBuckets = (now: number): void => {
  if (rateBuckets.size < 5000) return;
  for (const [key, value] of rateBuckets) {
    if (value.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
};

const makeRateKey = (ctx: KoaContext, action: Action): string => {
  const actorIdentity = getActorIdentity(ctx);
  return `${action}:${getClientIp(ctx)}:${actorIdentity}`;
};

const applyRateLimit = (ctx: KoaContext, action: Action): boolean => {
  const now = Date.now();
  const config = RATE_LIMITS[action];
  const key = makeRateKey(ctx, action);
  pruneRateBuckets(now);

  const existing = rateBuckets.get(key);
  const bucket =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + config.windowMs }
      : existing;

  bucket.count += 1;
  rateBuckets.set(key, bucket);

  if (bucket.count <= config.max) {
    return false;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  ctx.set('Retry-After', String(retryAfterSeconds));
  ctx.status = 429;
  ctx.body = {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      details: {
        retryAfterSeconds,
      },
    },
  };
  return true;
};

export default (_config: unknown, _context: { strapi: Core.Strapi }) => {
  return async (ctx: KoaContext, next: () => Promise<unknown>) => {
    const method = asString(ctx.request.method);
    const path = asString(ctx.request.path);
    const action = resolveAction(method, path);

    if (action && applyRateLimit(ctx, action)) {
      return;
    }

    await next();
  };
};
