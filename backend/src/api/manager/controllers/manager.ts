import type { Core } from '@strapi/strapi';
import {
  buildAuthorNameMapByIdeaId,
  resolveAuthorNameByFingerprint,
} from '../../public/controllers/lib/comment-authors';

declare const strapi: Core.Strapi;

type Ctx = {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  request: {
    body?: unknown;
  };
  status: number;
  body: unknown;
};

type ApiErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED';
type CommentTarget = 'idea' | 'roadmap';
type IdeaStatus = 'new' | 'under_review' | 'planned' | 'declined' | 'done';
type RoadmapStatus = 'planned' | 'in_progress' | 'done';
type ParentMeta = {
  title: string;
  status: string;
};

const IDEA_STATUSES = new Set<IdeaStatus>(['new', 'under_review', 'planned', 'declined', 'done']);
const ROADMAP_STATUSES = new Set<RoadmapStatus>(['planned', 'in_progress', 'done']);
const COMMENT_TARGETS = new Set<CommentTarget>(['idea', 'roadmap']);
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SCRIPT_OR_STYLE_REGEX = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;
const ACTOR_USER_FINGERPRINT_PREFIX = 'actor:user:';
const GUEST_AUTHOR_NAME = 'Guest';

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toPositiveInt = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const toPositiveIntFromUnknown = (value: unknown): number | null => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const extractIdeaParentId = (comment: any): number | null => {
  if (typeof comment.idea === 'number') return comment.idea;
  return toPositiveIntFromUnknown(comment.idea?.id);
};

const extractRoadmapParentId = (comment: any): number | null => {
  if (typeof comment.roadmapItem === 'number') return comment.roadmapItem;
  return toPositiveIntFromUnknown(comment.roadmapItem?.id);
};

const loadParentMetaMap = async (
  target: CommentTarget,
  parentIds: number[]
): Promise<Map<number, ParentMeta>> => {
  if (parentIds.length === 0) {
    return new Map<number, ParentMeta>();
  }

  if (target === 'idea') {
    const parents = await strapi.db.query('api::idea.idea').findMany({
      where: {
        id: {
          $in: parentIds,
        },
      },
      select: ['id', 'title', 'status'],
    });

    const result = new Map<number, ParentMeta>();
    for (const parent of parents as Array<{ id?: unknown; title?: unknown; status?: unknown }>) {
      const id = toPositiveIntFromUnknown(parent.id);
      if (!id) continue;
      result.set(id, {
        title: asString(parent.title),
        status: asString(parent.status),
      });
    }
    return result;
  }

  const parents = await strapi.db.query('api::roadmap-item.roadmap-item').findMany({
    where: {
      id: {
        $in: parentIds,
      },
    },
    select: ['id', 'title', 'status'],
  });

  const result = new Map<number, ParentMeta>();
  for (const parent of parents as Array<{ id?: unknown; title?: unknown; status?: unknown }>) {
    const id = toPositiveIntFromUnknown(parent.id);
    if (!id) continue;
    result.set(id, {
      title: asString(parent.title),
      status: asString(parent.status),
    });
  }
  return result;
};

const parseActorUserIdFromFingerprint = (fingerprint: unknown): number | null => {
  const normalized = asString(fingerprint);
  if (!normalized.startsWith(ACTOR_USER_FINGERPRINT_PREFIX)) {
    return null;
  }
  const rawUserId = normalized.slice(ACTOR_USER_FINGERPRINT_PREFIX.length);
  return toPositiveIntFromUnknown(rawUserId);
};

const fallbackAuthorNameFromFingerprint = (fingerprint: unknown): string => {
  const normalized = asString(fingerprint);
  return normalized || GUEST_AUTHOR_NAME;
};

const buildCommentAuthorNameMapById = async <
  TComment extends { id: number; userFingerprint?: unknown }
>(
  comments: TComment[]
): Promise<Map<number, string>> => {
  const actorUserIds = Array.from(
    new Set(
      comments
        .map((comment) => parseActorUserIdFromFingerprint(comment.userFingerprint))
        .filter((value): value is number => value !== null)
    )
  );

  const userNameById = new Map<number, string>();
  if (actorUserIds.length > 0) {
    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: {
        id: {
          $in: actorUserIds,
        },
      },
      select: ['id', 'username'],
    });

    for (const user of users as Array<{ id?: unknown; username?: unknown }>) {
      const userId = toPositiveIntFromUnknown(user.id);
      const username = asString(user.username);
      if (!userId || !username) continue;
      userNameById.set(userId, username);
    }
  }

  const authorNameByCommentId = new Map<number, string>();
  for (const comment of comments) {
    const actorUserId = parseActorUserIdFromFingerprint(comment.userFingerprint);
    if (actorUserId) {
      authorNameByCommentId.set(
        comment.id,
        userNameById.get(actorUserId) || fallbackAuthorNameFromFingerprint(comment.userFingerprint)
      );
      continue;
    }

    authorNameByCommentId.set(comment.id, fallbackAuthorNameFromFingerprint(comment.userFingerprint));
  }

  return authorNameByCommentId;
};

const resolveCommentAuthorName = async (fingerprint: unknown): Promise<string> => {
  const actorUserId = parseActorUserIdFromFingerprint(fingerprint);
  if (!actorUserId) {
    return fallbackAuthorNameFromFingerprint(fingerprint);
  }

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: actorUserId },
    select: ['id', 'username'],
  });
  return asString((user as { username?: unknown } | null)?.username) ||
    fallbackAuthorNameFromFingerprint(fingerprint);
};

const buildIdeaCommentsCountMap = async (ideaIds: number[]): Promise<Map<number, number>> => {
  const counts = new Map<number, number>();

  await Promise.all(
    ideaIds.map(async (ideaId) => {
      const total = await strapi.db.query('api::comment.comment').count({
        where: {
          idea: ideaId,
        },
      });
      counts.set(ideaId, total);
    })
  );

  return counts;
};

const normalizePlainText = (value: unknown, { multiline }: { multiline: boolean }): string => {
  const raw = asString(value);
  const withoutScripts = raw.replace(SCRIPT_OR_STYLE_REGEX, ' ');
  const withoutHtml = withoutScripts.replace(HTML_TAG_REGEX, ' ');
  const withoutControlChars = withoutHtml.replace(CONTROL_CHARS_REGEX, '');
  const withNormalizedNewLines = withoutControlChars.replace(/\r\n?/g, '\n');

  if (!multiline) {
    return withNormalizedNewLines.replace(/\s+/g, ' ').trim();
  }

  return withNormalizedNewLines
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const sendError = (ctx: Ctx, status: number, code: ApiErrorCode, message: string): void => {
  ctx.status = status;
  ctx.body = {
    error: {
      code,
      message,
    },
  };
};

const sanitizeRoadmap = (item: any) => ({
  id: item.id,
  documentId: item.documentId,
  title: item.title,
  description: item.description,
  status: item.status,
  category: item.category,
  votesCount: item.votesCount,
  commentsCount: item.commentsCount,
  isHidden: item.isHidden === true,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const sanitizeIdea = (idea: any) => ({
  id: idea.id,
  documentId: idea.documentId,
  title: idea.title,
  description: idea.description,
  status: idea.status,
  votesCount: idea.votesCount,
  commentsCount: toPositiveIntFromUnknown(idea.commentsCount) ?? 0,
  authorName: asString(idea.authorName) || GUEST_AUTHOR_NAME,
  isHidden: idea.isHidden === true,
  createdAt: idea.createdAt,
  updatedAt: idea.updatedAt,
});

const sanitizeComment = (comment: any, target: CommentTarget) => ({
  id: comment.id,
  target,
  text: comment.text,
  isHidden: comment.isHidden,
  userFingerprint: asString(comment.userFingerprint),
  authorName: asString(comment.authorName) || fallbackAuthorNameFromFingerprint(comment.userFingerprint),
  parentTitle: asString(comment.parentTitle) || null,
  parentStatus: asString(comment.parentStatus) || null,
  parentExists: comment.parentExists === true,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
});

const sanitizeTarget = (value: string): CommentTarget | null => {
  return COMMENT_TARGETS.has(value as CommentTarget) ? (value as CommentTarget) : null;
};

const isValidRoadmapStatus = (value: string): value is RoadmapStatus =>
  ROADMAP_STATUSES.has(value as RoadmapStatus);
const isValidIdeaStatus = (value: string): value is IdeaStatus =>
  IDEA_STATUSES.has(value as IdeaStatus);

export default {
  async listRoadmap(ctx: Ctx) {
    const items = await strapi.db.query('api::roadmap-item.roadmap-item').findMany({
      orderBy: [{ createdAt: 'desc' }],
    });
    ctx.body = { data: items.map(sanitizeRoadmap) };
  },

  async getRoadmap(ctx: Ctx) {
    const roadmapItemId = toPositiveInt(ctx.params.id);
    if (!roadmapItemId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap item id');
      return;
    }

    const item = await strapi.db.query('api::roadmap-item.roadmap-item').findOne({
      where: { id: roadmapItemId },
    });
    if (!item) {
      sendError(ctx, 404, 'NOT_FOUND', 'Roadmap item not found');
      return;
    }

    const comments = await strapi.db.query('api::roadmap-comment.roadmap-comment').findMany({
      where: {
        roadmapItem: roadmapItemId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    const authorNameByCommentId = await buildCommentAuthorNameMapById(comments);

    ctx.body = {
      data: {
        ...sanitizeRoadmap(item),
        comments: comments.map((comment: any) =>
          sanitizeComment(
            {
              ...comment,
              authorName: authorNameByCommentId.get(comment.id),
              parentTitle: item.title,
              parentStatus: item.status,
              parentExists: true,
            },
            'roadmap'
          )
        ),
      },
    };
  },

  async createRoadmap(ctx: Ctx) {
    const body = asObject(ctx.request.body);
    const title = normalizePlainText(body.title, { multiline: false });
    const description = normalizePlainText(body.description, { multiline: true });
    const rawStatus = asString(body.status);
    const category = normalizePlainText(body.category, { multiline: false });
    const status = rawStatus || 'planned';

    if (title.length < 3 || title.length > 120) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Title length must be between 3 and 120 characters');
      return;
    }
    if (description.length < 3 || description.length > 2000) {
      sendError(
        ctx,
        400,
        'VALIDATION_ERROR',
        'Description length must be between 3 and 2000 characters'
      );
      return;
    }
    if (!isValidRoadmapStatus(status)) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap status');
      return;
    }
    if (category.length > 80) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Category length must be 80 characters or less');
      return;
    }

    const created = await strapi.db.query('api::roadmap-item.roadmap-item').create({
      data: {
        title,
        description,
        status,
        category: category || null,
        votesCount: 0,
        commentsCount: 0,
        isHidden: false,
      },
    });

    ctx.status = 201;
    ctx.body = { data: sanitizeRoadmap(created) };
  },

  async updateRoadmap(ctx: Ctx) {
    const roadmapItemId = toPositiveInt(ctx.params.id);
    if (!roadmapItemId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap item id');
      return;
    }

    const existing = await strapi.db.query('api::roadmap-item.roadmap-item').findOne({
      where: { id: roadmapItemId },
    });
    if (!existing) {
      sendError(ctx, 404, 'NOT_FOUND', 'Roadmap item not found');
      return;
    }

    const body = asObject(ctx.request.body);
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = normalizePlainText(body.title, { multiline: false });
      if (title.length < 3 || title.length > 120) {
        sendError(ctx, 400, 'VALIDATION_ERROR', 'Title length must be between 3 and 120 characters');
        return;
      }
      data.title = title;
    }

    if (body.description !== undefined) {
      const description = normalizePlainText(body.description, { multiline: true });
      if (description.length < 3 || description.length > 2000) {
        sendError(
          ctx,
          400,
          'VALIDATION_ERROR',
          'Description length must be between 3 and 2000 characters'
        );
        return;
      }
      data.description = description;
    }

    if (body.status !== undefined) {
      const status = asString(body.status);
      if (!isValidRoadmapStatus(status)) {
        sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap status');
        return;
      }
      data.status = status;
    }

    if (body.category !== undefined) {
      const category = normalizePlainText(body.category, { multiline: false });
      if (category.length > 80) {
        sendError(ctx, 400, 'VALIDATION_ERROR', 'Category length must be 80 characters or less');
        return;
      }
      data.category = category || null;
    }

    if (Object.keys(data).length === 0) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'No valid fields to update');
      return;
    }

    const updated = await strapi.db.query('api::roadmap-item.roadmap-item').update({
      where: { id: roadmapItemId },
      data,
    });

    ctx.body = { data: sanitizeRoadmap(updated) };
  },

  async deleteRoadmap(ctx: Ctx) {
    const roadmapItemId = toPositiveInt(ctx.params.id);
    if (!roadmapItemId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap item id');
      return;
    }

    const existing = await strapi.db.query('api::roadmap-item.roadmap-item').findOne({
      where: { id: roadmapItemId },
    });
    if (!existing) {
      sendError(ctx, 404, 'NOT_FOUND', 'Roadmap item not found');
      return;
    }

    await strapi.db.query('api::roadmap-vote.roadmap-vote').deleteMany({
      where: { roadmapItemDocumentId: existing.documentId },
    });
    await strapi.db.query('api::roadmap-comment.roadmap-comment').deleteMany({
      where: { roadmapItem: roadmapItemId },
    });
    await strapi.db.query('api::roadmap-item.roadmap-item').delete({
      where: { id: roadmapItemId },
    });

    ctx.status = 204;
    ctx.body = null;
  },

  async updateRoadmapVisibility(ctx: Ctx) {
    const roadmapItemId = toPositiveInt(ctx.params.id);
    if (!roadmapItemId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid roadmap item id');
      return;
    }

    const existing = await strapi.db.query('api::roadmap-item.roadmap-item').findOne({
      where: { id: roadmapItemId },
    });
    if (!existing) {
      sendError(ctx, 404, 'NOT_FOUND', 'Roadmap item not found');
      return;
    }

    const body = asObject(ctx.request.body);
    if (typeof body.isHidden !== 'boolean') {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'isHidden must be boolean');
      return;
    }

    const updated = await strapi.db.query('api::roadmap-item.roadmap-item').update({
      where: { id: roadmapItemId },
      data: {
        isHidden: body.isHidden,
      },
    });

    ctx.body = { data: sanitizeRoadmap(updated) };
  },

  async listIdeas(ctx: Ctx) {
    const status = asString(ctx.query.status);
    if (status && !isValidIdeaStatus(status)) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea status');
      return;
    }

    const where = status ? { status } : {};
    const ideas = await strapi.db.query('api::idea.idea').findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });
    const authorNameByIdeaId = await buildAuthorNameMapByIdeaId(ideas);
    const ideaCommentCountById = await buildIdeaCommentsCountMap(
      ideas
        .map((idea: any) => toPositiveIntFromUnknown(idea.id))
        .filter((value): value is number => value !== null)
    );

    ctx.body = {
      data: ideas.map((idea: any) =>
        sanitizeIdea({
          ...idea,
          commentsCount: ideaCommentCountById.get(idea.id) ?? 0,
          authorName: authorNameByIdeaId.get(idea.id),
        })
      ),
    };
  },

  async getIdea(ctx: Ctx) {
    const ideaId = toPositiveInt(ctx.params.id);
    if (!ideaId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea id');
      return;
    }

    const idea = await strapi.db.query('api::idea.idea').findOne({
      where: { id: ideaId },
    });
    if (!idea) {
      sendError(ctx, 404, 'NOT_FOUND', 'Idea not found');
      return;
    }

    const comments = await strapi.db.query('api::comment.comment').findMany({
      where: {
        idea: ideaId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    const authorName = await resolveAuthorNameByFingerprint(idea.authorFingerprint);
    const authorNameByCommentId = await buildCommentAuthorNameMapById(comments);

    ctx.body = {
      data: {
        ...sanitizeIdea({
          ...idea,
          commentsCount: comments.length,
          authorName,
        }),
        comments: comments.map((comment: any) =>
          sanitizeComment(
            {
              ...comment,
              authorName: authorNameByCommentId.get(comment.id),
              parentTitle: idea.title,
              parentStatus: idea.status,
              parentExists: true,
            },
            'idea'
          )
        ),
      },
    };
  },

  async updateIdeaStatus(ctx: Ctx) {
    const ideaId = toPositiveInt(ctx.params.id);
    if (!ideaId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea id');
      return;
    }

    const idea = await strapi.db.query('api::idea.idea').findOne({
      where: { id: ideaId },
    });
    if (!idea) {
      sendError(ctx, 404, 'NOT_FOUND', 'Idea not found');
      return;
    }

    const body = asObject(ctx.request.body);
    const status = asString(body.status);
    if (!isValidIdeaStatus(status)) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea status');
      return;
    }

    const updated = await strapi.db.query('api::idea.idea').update({
      where: { id: ideaId },
      data: { status },
    });

    const authorName = await resolveAuthorNameByFingerprint(updated.authorFingerprint);
    const commentsCount = await strapi.db.query('api::comment.comment').count({
      where: {
        idea: ideaId,
      },
    });

    ctx.body = {
      data: sanitizeIdea({
        ...updated,
        commentsCount,
        authorName,
      }),
    };
  },

  async updateIdeaVisibility(ctx: Ctx) {
    const ideaId = toPositiveInt(ctx.params.id);
    if (!ideaId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea id');
      return;
    }

    const idea = await strapi.db.query('api::idea.idea').findOne({
      where: { id: ideaId },
    });
    if (!idea) {
      sendError(ctx, 404, 'NOT_FOUND', 'Idea not found');
      return;
    }

    const body = asObject(ctx.request.body);
    if (typeof body.isHidden !== 'boolean') {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'isHidden must be boolean');
      return;
    }

    const updated = await strapi.db.query('api::idea.idea').update({
      where: { id: ideaId },
      data: {
        isHidden: body.isHidden,
      },
    });

    const authorName = await resolveAuthorNameByFingerprint(updated.authorFingerprint);
    const commentsCount = await strapi.db.query('api::comment.comment').count({
      where: {
        idea: ideaId,
      },
    });

    ctx.body = {
      data: sanitizeIdea({
        ...updated,
        commentsCount,
        authorName,
      }),
    };
  },

  async deleteIdea(ctx: Ctx) {
    const ideaId = toPositiveInt(ctx.params.id);
    if (!ideaId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid idea id');
      return;
    }

    const idea = await strapi.db.query('api::idea.idea').findOne({
      where: { id: ideaId },
    });
    if (!idea) {
      sendError(ctx, 404, 'NOT_FOUND', 'Idea not found');
      return;
    }

    await strapi.db.query('api::vote.vote').deleteMany({
      where: { ideaDocumentId: idea.documentId },
    });
    await strapi.db.query('api::comment.comment').deleteMany({
      where: { idea: ideaId },
    });
    await strapi.db.query('api::idea.idea').delete({
      where: { id: ideaId },
    });

    ctx.status = 204;
    ctx.body = null;
  },

  async moderateComment(ctx: Ctx) {
    const target = sanitizeTarget(asString(ctx.params.target));
    if (!target) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid comment target');
      return;
    }

    const commentId = toPositiveInt(ctx.params.id);
    if (!commentId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid comment id');
      return;
    }

    const body = asObject(ctx.request.body);
    if (typeof body.isHidden !== 'boolean') {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'isHidden must be boolean');
      return;
    }

    const modelUid =
      target === 'idea' ? 'api::comment.comment' : 'api::roadmap-comment.roadmap-comment';
    const existing = await strapi.db.query(modelUid).findOne({
      where: { id: commentId },
    });

    if (!existing) {
      sendError(ctx, 404, 'NOT_FOUND', 'Comment not found');
      return;
    }

    const updated = await strapi.db.query(modelUid).update({
      where: { id: commentId },
      data: { isHidden: body.isHidden },
    });

    if (target === 'roadmap' && body.isHidden !== existing.isHidden) {
      const roadmapItemId =
        typeof existing.roadmapItem === 'number'
          ? existing.roadmapItem
          : existing.roadmapItem?.id ?? null;

      if (typeof roadmapItemId === 'number' && roadmapItemId > 0) {
        await strapi.db.connection('roadmap_items').where({ id: roadmapItemId }).update({
          comments_count: body.isHidden
            ? strapi.db.connection.raw('GREATEST(COALESCE(comments_count, 0) - 1, 0)')
            : strapi.db.connection.raw('COALESCE(comments_count, 0) + 1'),
        });
      }
    }

    const authorName = await resolveCommentAuthorName(updated.userFingerprint);
    const parentId =
      target === 'idea' ? extractIdeaParentId(updated) : extractRoadmapParentId(updated);
    const parentMetaById = await loadParentMetaMap(target, parentId ? [parentId] : []);
    const parentMeta = parentId ? parentMetaById.get(parentId) : null;

    ctx.body = {
      data: {
        ...sanitizeComment(
          {
            ...updated,
            authorName,
            parentTitle: parentMeta?.title ?? null,
            parentStatus: parentMeta?.status ?? null,
            parentExists: parentMetaById.has(parentId ?? -1),
          },
          target
        ),
        parentId,
      },
    };
  },

  async deleteComment(ctx: Ctx) {
    const target = sanitizeTarget(asString(ctx.params.target));
    if (!target) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid comment target');
      return;
    }

    const commentId = toPositiveInt(ctx.params.id);
    if (!commentId) {
      sendError(ctx, 400, 'VALIDATION_ERROR', 'Invalid comment id');
      return;
    }

    const modelUid =
      target === 'idea' ? 'api::comment.comment' : 'api::roadmap-comment.roadmap-comment';

    const existing = await strapi.db.query(modelUid).findOne({
      where: { id: commentId },
    });
    if (!existing) {
      sendError(ctx, 404, 'NOT_FOUND', 'Comment not found');
      return;
    }

    if (target === 'roadmap') {
      const roadmapItemId =
        typeof existing.roadmapItem === 'number'
          ? existing.roadmapItem
          : existing.roadmapItem?.id ?? null;

      if (typeof roadmapItemId === 'number' && roadmapItemId > 0) {
        await strapi.db.connection('roadmap_items').where({ id: roadmapItemId }).update({
          comments_count: strapi.db.connection.raw(
            'GREATEST(COALESCE(comments_count, 0) - 1, 0)'
          ),
        });
      }
    }

    await strapi.db.query(modelUid).delete({
      where: { id: commentId },
    });

    ctx.status = 204;
    ctx.body = null;
  },
};
