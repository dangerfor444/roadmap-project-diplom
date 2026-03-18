import type { Core } from '@strapi/strapi';
import { issueSignedActorToken, extractBearerToken, isWidgetInternalAuthEnabled } from '../lib/auth';
import { sendError } from '../lib/errors';
import type { Ctx } from '../lib/types';
import { asString, toPositiveIntFromUnknown } from '../lib/utils';

declare const strapi: Core.Strapi;

export const issueActorToken = async (ctx: Ctx): Promise<void> => {
  if (!isWidgetInternalAuthEnabled()) {
    sendError(ctx, 403, 'VALIDATION_ERROR', 'Widget internal auth is disabled');
    return;
  }

  const actorTokenSecret = asString(process.env.PUBLIC_ACTOR_TOKEN_SECRET);
  if (!actorTokenSecret) {
    sendError(ctx, 500, 'VALIDATION_ERROR', 'PUBLIC_ACTOR_TOKEN_SECRET is not configured');
    return;
  }

  const bearerToken = extractBearerToken(ctx);
  if (!bearerToken) {
    sendError(ctx, 401, 'UNAUTHORIZED', 'Authorization bearer token is required');
    return;
  }

  let jwtPayload: { id?: unknown } = {};
  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt') as {
      verify: (token: string) => Promise<{ id?: unknown }>;
    };
    jwtPayload = await jwtService.verify(bearerToken);
  } catch {
    sendError(ctx, 401, 'UNAUTHORIZED', 'Invalid authorization token');
    return;
  }

  const userId = toPositiveIntFromUnknown(jwtPayload.id);
  if (!userId) {
    sendError(ctx, 401, 'UNAUTHORIZED', 'Invalid authorization token payload');
    return;
  }

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
  });

  if (!user || user.blocked === true) {
    sendError(ctx, 401, 'UNAUTHORIZED', 'User is not available for widget auth');
    return;
  }

  const actorId = `user:${user.id}`;
  const { actorToken, exp } = issueSignedActorToken(actorId, actorTokenSecret);

  ctx.body = {
    data: {
      actorId,
      actorToken,
      exp,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    },
  };
};
