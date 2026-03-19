import type { Core } from '@strapi/strapi';
import { ROADMAP_ITEM_TABLE_NAME } from '../lib/constants';
import { resolveActorContext } from '../lib/auth';
import { resolveAuthorNameByFingerprint } from '../lib/comment-authors';
import { getPostgresErrorCode, sendError } from '../lib/errors';
import { sanitizeRoadmapComment } from '../lib/sanitize';
import { normalizePlainText } from '../lib/text';
import type { Ctx } from '../lib/types';
import { asObject, toPositiveInt } from '../lib/utils';

declare const strapi: Core.Strapi;

export const roadmapVote = async (ctx: Ctx): Promise<void> => {
  const roadmapItemId = toPositiveInt(ctx.params.id);

  if (!roadmapItemId) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap item id');
    return;
  }

  const body = asObject(ctx.request.body);
  const actorResult = resolveActorContext(ctx, body);

  if (actorResult.ok === false) {
    sendError(ctx, 400, 'VALIDATION_ERROR', actorResult.message);
    return;
  }
  const { storageFingerprint } = actorResult.actor;

  const roadmapItem = await strapi.db.query('api::roadmap-item.roadmap-item').findOne({
    where: { id: roadmapItemId, isHidden: false },
  });

  if (!roadmapItem) {
    sendError(ctx, 404, 'NOT_FOUND', 'Roadmap item not found');
    return;
  }

  try {
    await strapi.db.query('api::roadmap-vote.roadmap-vote').create({
      data: {
        roadmapItem: roadmapItem.id,
        roadmapItemDocumentId: roadmapItem.documentId,
        userFingerprint: storageFingerprint,
      },
    });
  } catch (error) {
    if (getPostgresErrorCode(error) === '23505') {
      sendError(ctx, 409, 'CONFLICT', 'You have already voted for this roadmap item');
      return;
    }
    throw error;
  }

  const incrementResult = await strapi.db.connection(ROADMAP_ITEM_TABLE_NAME)
    .where({ id: roadmapItem.id })
    .update({
      votes_count: strapi.db.connection.raw('COALESCE(votes_count, 0) + 1'),
    })
    .returning(['votes_count']);

  const firstRow = Array.isArray(incrementResult) ? incrementResult[0] : null;
  const nextVotesCount = Number(firstRow?.votes_count ?? (roadmapItem.votesCount ?? 0) + 1);

  ctx.status = 201;
  ctx.body = {
    data: {
      roadmapItemId: roadmapItem.id,
      votesCount: nextVotesCount,
      voted: true,
    },
  };
};

export const roadmapUnvote = async (ctx: Ctx): Promise<void> => {
  const roadmapItemId = toPositiveInt(ctx.params.id);

  if (!roadmapItemId) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap item id');
    return;
  }

  const body = asObject(ctx.request.body);
  const actorResult = resolveActorContext(ctx, body);

  if (actorResult.ok === false) {
    sendError(ctx, 400, 'VALIDATION_ERROR', actorResult.message);
    return;
  }
  const { storageFingerprint } = actorResult.actor;

  const roadmapItem = await strapi.db.query('api::roadmap-item.roadmap-item').findOne({
    where: { id: roadmapItemId, isHidden: false },
  });

  if (!roadmapItem) {
    sendError(ctx, 404, 'NOT_FOUND', 'Roadmap item not found');
    return;
  }

  const existingVote = await strapi.db.query('api::roadmap-vote.roadmap-vote').findOne({
    where: {
      roadmapItemDocumentId: roadmapItem.documentId,
      userFingerprint: storageFingerprint,
    },
  });

  if (!existingVote) {
    ctx.status = 200;
    ctx.body = {
      data: {
        roadmapItemId: roadmapItem.id,
        votesCount: Number(roadmapItem.votesCount ?? 0),
        voted: false,
      },
    };
    return;
  }

  await strapi.db.query('api::roadmap-vote.roadmap-vote').delete({
    where: { id: existingVote.id },
  });

  const decrementResult = await strapi.db.connection(ROADMAP_ITEM_TABLE_NAME)
    .where({ id: roadmapItem.id })
    .update({
      votes_count: strapi.db.connection.raw('GREATEST(COALESCE(votes_count, 0) - 1, 0)'),
    })
    .returning(['votes_count']);

  const firstRow = Array.isArray(decrementResult) ? decrementResult[0] : null;
  const nextVotesCount = Math.max(
    0,
    Number(firstRow?.votes_count ?? (roadmapItem.votesCount ?? 1) - 1)
  );

  ctx.status = 200;
  ctx.body = {
    data: {
      roadmapItemId: roadmapItem.id,
      votesCount: nextVotesCount,
      voted: false,
    },
  };
};

export const roadmapComment = async (ctx: Ctx): Promise<void> => {
  const roadmapItemId = toPositiveInt(ctx.params.id);

  if (!roadmapItemId) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap item id');
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

  const roadmapItem = await strapi.db.query('api::roadmap-item.roadmap-item').findOne({
    where: { id: roadmapItemId, isHidden: false },
  });

  if (!roadmapItem) {
    sendError(ctx, 404, 'NOT_FOUND', 'Roadmap item not found');
    return;
  }

  const created = await strapi.db.query('api::roadmap-comment.roadmap-comment').create({
    data: {
      roadmapItem: roadmapItem.id,
      text,
      userFingerprint: storageFingerprint,
      isHidden: false,
    },
  });
  const authorName = await resolveAuthorNameByFingerprint(created.userFingerprint);

  const incrementResult = await strapi.db.connection(ROADMAP_ITEM_TABLE_NAME)
    .where({ id: roadmapItem.id })
    .update({
      comments_count: strapi.db.connection.raw('COALESCE(comments_count, 0) + 1'),
    })
    .returning(['comments_count']);

  const firstRow = Array.isArray(incrementResult) ? incrementResult[0] : null;
  const nextCommentsCount = Number(firstRow?.comments_count ?? (roadmapItem.commentsCount ?? 0) + 1);

  ctx.status = 201;
  ctx.body = {
    data: {
      ...sanitizeRoadmapComment({
        ...created,
        authorName,
      }),
      roadmapItemId: roadmapItem.id,
      commentsCount: nextCommentsCount,
    },
  };
};
