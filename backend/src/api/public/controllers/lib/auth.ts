import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ACTOR_ID_PATTERN,
  ACTOR_TOKEN_TTL_SECONDS_DEFAULT,
  FINGERPRINT_PATTERN,
  WIDGET_INTERNAL_AUTH_DISABLED_VALUES,
  WRITE_AUTH_MODES,
} from './constants';
import type { ActorContextResult, ActorTokenVerifyResult, Ctx, WriteAuthMode } from './types';
import { asString, getHeaderValue } from './utils';

const isValidFingerprint = (value: string): boolean => FINGERPRINT_PATTERN.test(value);
const isValidActorId = (value: string): boolean => ACTOR_ID_PATTERN.test(value);

const toBase64Url = (value: Buffer): string =>
  value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const decodeBase64Url = (value: string): string | null => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = normalized.length % 4;
  const padded = padLength === 0 ? normalized : `${normalized}${'='.repeat(4 - padLength)}`;

  try {
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
};

const verifyActorToken = (token: string, secret: string): ActorTokenVerifyResult => {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return {
      ok: false,
      message: 'Invalid actor token format',
    };
  }

  const [payloadPart, signaturePart] = parts;
  if (!payloadPart || !signaturePart) {
    return {
      ok: false,
      message: 'Invalid actor token format',
    };
  }

  const expectedSignature = toBase64Url(createHmac('sha256', secret).update(payloadPart).digest());
  const providedSignature = Buffer.from(signaturePart, 'utf8');
  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    providedSignature.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignature, expectedSignatureBuffer)
  ) {
    return {
      ok: false,
      message: 'Invalid actor token signature',
    };
  }

  const payloadJson = decodeBase64Url(payloadPart);
  if (!payloadJson) {
    return {
      ok: false,
      message: 'Invalid actor token payload',
    };
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(payloadJson);
  } catch {
    return {
      ok: false,
      message: 'Invalid actor token payload',
    };
  }

  const payload = parsedPayload as { actorId?: unknown; exp?: unknown };
  const actorId = asString(payload.actorId);
  if (!isValidActorId(actorId)) {
    return {
      ok: false,
      message: 'Invalid actor token actorId',
    };
  }

  if (payload.exp !== undefined) {
    const exp = typeof payload.exp === 'number' ? payload.exp : Number.NaN;
    if (!Number.isFinite(exp)) {
      return {
        ok: false,
        message: 'Invalid actor token exp',
      };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (exp <= nowSeconds) {
      return {
        ok: false,
        message: 'Actor token is expired',
      };
    }
  }

  return {
    ok: true,
    actorId,
  };
};

const resolveActorTokenTtlSeconds = (): number => {
  const raw = asString(process.env.PUBLIC_ACTOR_TOKEN_TTL_SECONDS);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return ACTOR_TOKEN_TTL_SECONDS_DEFAULT;
  }
  return Math.min(Math.max(parsed, 300), 7 * 24 * 60 * 60);
};

const buildActorStorageFingerprint = (actorId: string): string => `actor:${actorId}`;

export const isWidgetInternalAuthEnabled = (): boolean => {
  const raw = asString(process.env.WIDGET_INTERNAL_AUTH_ENABLED || 'true').toLowerCase();
  if (!raw) return true;
  return !WIDGET_INTERNAL_AUTH_DISABLED_VALUES.has(raw);
};

export const issueSignedActorToken = (
  actorId: string,
  secret: string
): {
  actorToken: string;
  exp: number;
} => {
  const exp = Math.floor(Date.now() / 1000) + resolveActorTokenTtlSeconds();
  const payloadJson = JSON.stringify({ actorId, exp });
  const payloadPart = toBase64Url(Buffer.from(payloadJson, 'utf8'));
  const signaturePart = toBase64Url(createHmac('sha256', secret).update(payloadPart).digest());

  return {
    actorToken: `${payloadPart}.${signaturePart}`,
    exp,
  };
};

export const extractBearerToken = (ctx: Ctx): string => {
  const authorization = getHeaderValue(ctx, 'authorization');
  if (!authorization) return '';

  const parts = authorization.split(/\s+/);
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return '';
  }

  return asString(parts[1]);
};

const resolveWriteAuthMode = (): WriteAuthMode => {
  const configured = String(process.env.PUBLIC_WRITE_AUTH_MODE || 'auth').trim().toLowerCase();
  if (WRITE_AUTH_MODES.has(configured)) {
    return configured as WriteAuthMode;
  }
  return 'auth';
};

export const resolveActorContext = (
  ctx: Ctx,
  body: Record<string, unknown>
): ActorContextResult => {
  const mode = resolveWriteAuthMode();
  const actorIdFromHeader =
    asString(getHeaderValue(ctx, 'x-actor-id')) || asString(getHeaderValue(ctx, 'x-user-id'));
  const actorToken = asString(getHeaderValue(ctx, 'x-actor-token'));
  const actorTokenSecret = asString(process.env.PUBLIC_ACTOR_TOKEN_SECRET);
  const userFingerprint = asString(body.userFingerprint);
  let actorIdFromToken = '';

  if (actorToken) {
    if (!actorTokenSecret) {
      return {
        ok: false,
        message: 'Actor token is not supported on this environment',
      };
    }

    const tokenResult = verifyActorToken(actorToken, actorTokenSecret);
    if (tokenResult.ok === false) {
      return {
        ok: false,
        message: tokenResult.message,
      };
    }

    actorIdFromToken = tokenResult.actorId;
  }

  if (actorIdFromToken && actorIdFromHeader && actorIdFromToken !== actorIdFromHeader) {
    return {
      ok: false,
      message: 'x-actor-id does not match actor token',
    };
  }

  const actorId = actorIdFromToken || actorIdFromHeader;

  if (actorId && !isValidActorId(actorId)) {
    return {
      ok: false,
      message: 'Invalid x-actor-id header',
    };
  }

  if (userFingerprint && !isValidFingerprint(userFingerprint)) {
    return {
      ok: false,
      message: 'Invalid userFingerprint',
    };
  }

  if (actorId) {
    return {
      ok: true,
      actor: {
        mode,
        actorId,
        userFingerprint: null,
        storageFingerprint: buildActorStorageFingerprint(actorId),
      },
    };
  }

  if (mode === 'auth') {
    if (actorTokenSecret) {
      return {
        ok: false,
        message: 'Authenticated actor token is required (x-actor-token header)',
      };
    }

    return {
      ok: false,
      message: 'Authenticated actor is required (x-actor-id header)',
    };
  }

  if (!userFingerprint) {
    return {
      ok: false,
      message:
        mode === 'hybrid'
          ? 'Either x-actor-id header or userFingerprint is required'
          : 'Invalid userFingerprint',
    };
  }

  return {
    ok: true,
    actor: {
      mode,
      actorId: null,
      userFingerprint,
      storageFingerprint: userFingerprint,
    },
  };
};
