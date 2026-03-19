import type { Core } from '@strapi/strapi';
import { IDEA_TABLE_NAME } from '../lib/constants';
import { resolveActorContext } from '../lib/auth';
import { resolveAuthorNameByFingerprint } from '../lib/comment-authors';
import { getPostgresErrorCode, sendError } from '../lib/errors';
import { sanitizeComment, sanitizeIdea } from '../lib/sanitize';
import { normalizePlainText } from '../lib/text';
import type { Ctx } from '../lib/types';
import { asObject, toPositiveInt } from '../lib/utils';

declare const strapi: Core.Strapi;

export const createIdea = async (ctx: Ctx): Promise<void> => {
  const body = asObject(ctx.request.body);
  const title = normalizePlainText(body.title, { multiline: false });
  const description = normalizePlainText(body.description, { multiline: true });
  const actorResult = resolveActorContext(ctx, body);

  if (actorResult.ok === false) {
    sendError(ctx, 400, 'VALIDATION_ERROR', actorResult.message);
    return;
  }
  const { storageFingerprint } = actorResult.actor;

  if (title.length < 3 || title.length > 140) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Title length must be between 3 and 140 characters');
    return;
  }

  if (description.length < 3 || description.length > 3000) {
    sendError(
      ctx,
      400,
      'VALIDATION_ERROR',
      'Description length must be between 3 and 3000 characters'
    );
    return;
  }

  const created = await strapi.db.query('api::idea.idea').create({
    data: {
      title,
      description,
      status: 'new',
      votesCount: 0,
      authorFingerprint: storageFingerprint,
    },
  });
  const authorName = await resolveAuthorNameByFingerprint(created.authorFingerprint);

  ctx.status = 201;
  ctx.body = {
    data: sanitizeIdea({
      ...created,
      authorName,
    }),
  };
};

export const vote = async (ctx: Ctx): Promise<void> => {
  const ideaId = toPositiveInt(ctx.params.id);

  if (!ideaId) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea id');
    return;
  }

  const body = asObject(ctx.request.body);
  const actorResult = resolveActorContext(ctx, body);

  if (actorResult.ok === false) {
    sendError(ctx, 400, 'VALIDATION_ERROR', actorResult.message);
    return;
  }
  const { storageFingerprint } = actorResult.actor;

  const idea = await strapi.db.query('api::idea.idea').findOne({
    where: { id: ideaId, isHidden: false },
  });

  if (!idea) {
    sendError(ctx, 404, 'NOT_FOUND', 'Idea not found');
    return;
  }

  try {
    await strapi.db.query('api::vote.vote').create({
      data: {
        idea: idea.id,
        ideaDocumentId: idea.documentId,
        userFingerprint: storageFingerprint,
      },
    });
  } catch (error) {
    if (getPostgresErrorCode(error) === '23505') {
      sendError(ctx, 409, 'CONFLICT', 'You have already voted for this idea');
      return;
    }
    throw error;
  }

  const incrementResult = await strapi.db.connection(IDEA_TABLE_NAME)
    .where({ id: idea.id })
    .update({
      votes_count: strapi.db.connection.raw('COALESCE(votes_count, 0) + 1'),
    })
    .returning(['votes_count']);

  const firstRow = Array.isArray(incrementResult) ? incrementResult[0] : null;
  const nextVotesCount = Number(firstRow?.votes_count ?? (idea.votesCount ?? 0) + 1);

  ctx.status = 201;
  ctx.body = {
    data: {
      ideaId: idea.id,
      votesCount: nextVotesCount,
      voted: true,
    },
  };
};

export const unvote = async (ctx: Ctx): Promise<void> => {
  const ideaId = toPositiveInt(ctx.params.id);

  if (!ideaId) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea id');
    return;
  }

  const body = asObject(ctx.request.body);
  const actorResult = resolveActorContext(ctx, body);

  if (actorResult.ok === false) {
    sendError(ctx, 400, 'VALIDATION_ERROR', actorResult.message);
    return;
  }
  const { storageFingerprint } = actorResult.actor;

  const idea = await strapi.db.query('api::idea.idea').findOne({
    where: { id: ideaId, isHidden: false },
  });

  if (!idea) {
    sendError(ctx, 404, 'NOT_FOUND', 'Idea not found');
    return;
  }

  const existingVote = await strapi.db.query('api::vote.vote').findOne({
    where: {
      ideaDocumentId: idea.documentId,
      userFingerprint: storageFingerprint,
    },
  });

  if (!existingVote) {
    ctx.status = 200;
    ctx.body = {
      data: {
        ideaId: idea.id,
        votesCount: Number(idea.votesCount ?? 0),
        voted: false,
      },
    };
    return;
  }

  await strapi.db.query('api::vote.vote').delete({
    where: { id: existingVote.id },
  });

  const decrementResult = await strapi.db.connection(IDEA_TABLE_NAME)
    .where({ id: idea.id })
    .update({
      votes_count: strapi.db.connection.raw('GREATEST(COALESCE(votes_count, 0) - 1, 0)'),
    })
    .returning(['votes_count']);

  const firstRow = Array.isArray(decrementResult) ? decrementResult[0] : null;
  const nextVotesCount = Math.max(0, Number(firstRow?.votes_count ?? (idea.votesCount ?? 1) - 1));

  ctx.status = 200;
  ctx.body = {
    data: {
      ideaId: idea.id,
      votesCount: nextVotesCount,
      voted: false,
    },
  };
};

export const comment = async (ctx: Ctx): Promise<void> => {
  const ideaId = toPositiveInt(ctx.params.id);

  if (!ideaId) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea id');
    return;
  }

  const body = asObject(ctx.request.body);
  const text = normalizePlainText(body.text, { multiline: true });
  const actorResult = resolveActorContext(ctx, body);

  if (text.length < 1 || text.length > 2000) {
    sendError(
      ctx,
      400,
      'VALIDATION_ERROR',
      'Comment text length must be between 1 and 2000 characters'
    );
    return;
  }

  if (actorResult.ok === false) {
    sendError(ctx, 400, 'VALIDATION_ERROR', actorResult.message);
    return;
  }
  const { storageFingerprint } = actorResult.actor;

  const idea = await strapi.db.query('api::idea.idea').findOne({
    where: { id: ideaId, isHidden: false },
  });

  if (!idea) {
    sendError(ctx, 404, 'NOT_FOUND', 'Idea not found');
    return;
  }

  const created = await strapi.db.query('api::comment.comment').create({
    data: {
      idea: idea.id,
      text,
      userFingerprint: storageFingerprint,
      isHidden: false,
    },
  });
  const authorName = await resolveAuthorNameByFingerprint(created.userFingerprint);

  ctx.status = 201;
  ctx.body = {
    data: sanitizeComment({
      ...created,
      authorName,
    }),
  };
};
