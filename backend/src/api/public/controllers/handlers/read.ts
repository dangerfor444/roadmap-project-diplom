import type { Core } from '@strapi/strapi';
import { IDEA_SORTS, ROADMAP_STATUSES } from '../lib/constants';
import {
  buildAuthorNameMapByCommentId,
  buildAuthorNameMapByIdeaId,
  resolveAuthorNameByFingerprint,
} from '../lib/comment-authors';
import { sendError } from '../lib/errors';
import { sanitizeComment, sanitizeIdea, sanitizeRoadmapComment, sanitizeRoadmapItem } from '../lib/sanitize';
import type { Ctx } from '../lib/types';
import { asString, toPositiveInt } from '../lib/utils';

declare const strapi: Core.Strapi;

const buildVisibleIdeaCommentCountByIdeaId = async (ideaIds: number[]): Promise<Map<number, number>> => {
  if (ideaIds.length === 0) {
    return new Map<number, number>();
  }

  const ideaIdSet = new Set(ideaIds);
  const comments = await strapi.db.query('api::comment.comment').findMany({
    where: {
      isHidden: false,
    },
    select: ['id'],
    populate: {
      idea: {
        select: ['id'],
      },
    },
  });

  const result = new Map<number, number>();
  for (const ideaId of ideaIds) {
    result.set(ideaId, 0);
  }

  for (const comment of comments as Array<{ idea?: unknown }>) {
    const rawIdea = comment.idea as { id?: unknown } | number | undefined;
    const relatedIdeaId =
      typeof rawIdea === 'number'
        ? rawIdea
        : Number.parseInt(String(rawIdea?.id ?? ''), 10);

    if (!Number.isInteger(relatedIdeaId) || relatedIdeaId <= 0) {
      continue;
    }
    if (!ideaIdSet.has(relatedIdeaId)) {
      continue;
    }

    result.set(relatedIdeaId, (result.get(relatedIdeaId) ?? 0) + 1);
  }

  return result;
};

export const roadmap = async (ctx: Ctx): Promise<void> => {
  const status = asString(ctx.query.status);

  if (status && !ROADMAP_STATUSES.has(status)) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap status');
    return;
  }

  const where = status ? { status } : {};

  const items = await strapi.db.query('api::roadmap-item.roadmap-item').findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
  });

  ctx.body = {
    data: items.map(sanitizeRoadmapItem),
  };
};

export const roadmapItem = async (ctx: Ctx): Promise<void> => {
  const roadmapItemId = toPositiveInt(ctx.params.id);

  if (!roadmapItemId) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap item id');
    return;
  }

  const roadmapItem = await strapi.db.query('api::roadmap-item.roadmap-item').findOne({
    where: { id: roadmapItemId },
  });

  if (!roadmapItem) {
    sendError(ctx, 404, 'NOT_FOUND', 'Roadmap item not found');
    return;
  }

  const comments = await strapi.db.query('api::roadmap-comment.roadmap-comment').findMany({
    where: {
      roadmapItem: roadmapItemId,
      isHidden: false,
    },
    orderBy: [{ createdAt: 'asc' }],
  });
  const authorNameByCommentId = await buildAuthorNameMapByCommentId(comments);

  ctx.body = {
    data: {
      ...sanitizeRoadmapItem(roadmapItem),
      comments: comments.map((comment: any) =>
        sanitizeRoadmapComment({
          ...comment,
          authorName: authorNameByCommentId.get(comment.id),
        })
      ),
    },
  };
};

export const ideas = async (ctx: Ctx): Promise<void> => {
  const sort = asString(ctx.query.sort) || 'top';

  if (!IDEA_SORTS.has(sort)) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid ideas sort');
    return;
  }

  const orderBy =
    sort === 'new' ? [{ createdAt: 'desc' }] : [{ votesCount: 'desc' }, { createdAt: 'desc' }];

  const ideasData = await strapi.db.query('api::idea.idea').findMany({
    orderBy,
  });
  const authorNameByIdeaId = await buildAuthorNameMapByIdeaId(ideasData);
  const ideaIds = ideasData
    .map((idea: any) => Number.parseInt(String(idea.id ?? ''), 10))
    .filter((ideaId: number) => Number.isInteger(ideaId) && ideaId > 0);
  const commentsCountByIdeaId = await buildVisibleIdeaCommentCountByIdeaId(ideaIds);

  ctx.body = {
    data: ideasData.map((idea: any) =>
      sanitizeIdea({
        ...idea,
        commentsCount: commentsCountByIdeaId.get(idea.id) ?? 0,
        authorName: authorNameByIdeaId.get(idea.id),
      })
    ),
  };
};

export const idea = async (ctx: Ctx): Promise<void> => {
  const ideaId = toPositiveInt(ctx.params.id);

  if (!ideaId) {
    sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea id');
    return;
  }

  const ideaData = await strapi.db.query('api::idea.idea').findOne({
    where: { id: ideaId },
  });

  if (!ideaData) {
    sendError(ctx, 404, 'NOT_FOUND', 'Idea not found');
    return;
  }
  const ideaAuthorName = await resolveAuthorNameByFingerprint(ideaData.authorFingerprint);

  const comments = await strapi.db.query('api::comment.comment').findMany({
    where: {
      idea: ideaId,
      isHidden: false,
    },
    orderBy: [{ createdAt: 'asc' }],
  });
  const authorNameByCommentId = await buildAuthorNameMapByCommentId(comments);

  ctx.body = {
    data: {
      ...sanitizeIdea({
        ...ideaData,
        commentsCount: comments.length,
        authorName: ideaAuthorName,
      }),
      comments: comments.map((comment: any) =>
        sanitizeComment({
          ...comment,
          authorName: authorNameByCommentId.get(comment.id),
        })
      ),
    },
  };
};
