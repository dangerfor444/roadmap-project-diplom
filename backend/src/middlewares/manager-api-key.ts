import type { Core } from '@strapi/strapi';

type KoaContext = {
  request: {
    headers?: Record<string, string | string[] | undefined>;
  };
  status: number;
  body: unknown;
};

const getHeaderValue = (ctx: KoaContext, headerName: string): string => {
  const header = ctx.request.headers?.[headerName];
  if (Array.isArray(header)) return header[0] ?? '';
  return typeof header === 'string' ? header : '';
};

const parseBearer = (authorization: string): string => {
  const trimmed = authorization.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return '';
  }
  return trimmed.slice(7).trim();
};

const resolveAllowedManagerEmails = (): Set<string> => {
  const raw = String(process.env.MANAGER_ALLOWED_EMAILS ?? '').trim();

  const emails = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return new Set(emails);
};

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const allowedEmails = resolveAllowedManagerEmails();
  const hasAllowedEmails = allowedEmails.size > 0;

  return async (ctx: KoaContext, next: () => Promise<unknown>) => {
    if (!hasAllowedEmails) {
      strapi.log.error(
        '[ManagerAPI] MANAGER_ALLOWED_EMAILS is empty. Manager API access is disabled.'
      );
      ctx.status = 503;
      ctx.body = {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'MANAGER_ALLOWED_EMAILS is not configured',
        },
      };
      return;
    }

    const authHeader = getHeaderValue(ctx, 'authorization');
    const bearerToken = parseBearer(authHeader);

    if (!bearerToken) {
      strapi.log.warn('[ManagerAPI] Unauthorized request without bearer token.');
      ctx.status = 401;
      ctx.body = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Требуется заголовок Authorization: Bearer <token>',
        },
      };
      return;
    }

    let jwtPayload: { id?: unknown } = {};
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt') as {
        verify: (token: string) => Promise<{ id?: unknown }>;
      };
      jwtPayload = await jwtService.verify(bearerToken);
    } catch {
      strapi.log.warn('[ManagerAPI] Unauthorized request with invalid bearer token.');
      ctx.status = 401;
      ctx.body = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Некорректный токен авторизации',
        },
      };
      return;
    }

    const userId =
      typeof jwtPayload.id === 'number'
        ? jwtPayload.id
        : typeof jwtPayload.id === 'string'
          ? Number.parseInt(jwtPayload.id, 10)
          : Number.NaN;

    if (!Number.isInteger(userId) || userId <= 0) {
      strapi.log.warn('[ManagerAPI] Unauthorized token payload (missing user id).');
      ctx.status = 401;
      ctx.body = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Некорректный payload токена авторизации',
        },
      };
      return;
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
    });

    const normalizedEmail =
      user && typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';

    if (!user || user.blocked === true || !normalizedEmail) {
      strapi.log.warn(`[ManagerAPI] User ${String(userId)} is not allowed to access manager API.`);
      ctx.status = 403;
      ctx.body = {
        error: {
          code: 'FORBIDDEN',
          message: 'Доступ к панели управления запрещён для этого пользователя',
        },
      };
      return;
    }

    if (!allowedEmails.has(normalizedEmail)) {
      strapi.log.warn(
        `[ManagerAPI] User ${String(userId)} with email ${normalizedEmail} is not in manager allowlist.`
      );
      ctx.status = 403;
      ctx.body = {
        error: {
          code: 'FORBIDDEN',
          message: 'Доступ к панели управления разрешён только администратору',
        },
      };
      return;
    }

    await next();
  };
};
