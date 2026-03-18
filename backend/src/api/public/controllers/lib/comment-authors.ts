import type { Core } from '@strapi/strapi';
import { asString, toPositiveIntFromUnknown } from './utils';

declare const strapi: Core.Strapi;

const ACTOR_USER_FINGERPRINT_PREFIX = 'actor:user:';
const GUEST_AUTHOR_NAME = 'Guest';

const parseUserIdFromFingerprint = (fingerprint: unknown): number | null => {
  const normalized = asString(fingerprint);
  if (!normalized.startsWith(ACTOR_USER_FINGERPRINT_PREFIX)) {
    return null;
  }

  const userIdRaw = normalized.slice(ACTOR_USER_FINGERPRINT_PREFIX.length);
  return toPositiveIntFromUnknown(userIdRaw);
};

const resolveUserNameByIdMap = async (
  userIds: number[]
): Promise<Map<number, string>> => {
  if (userIds.length === 0) {
    return new Map<number, string>();
  }

  const users = await strapi.db.query('plugin::users-permissions.user').findMany({
    where: {
      id: {
        $in: userIds,
      },
    },
    select: ['id', 'username'],
  });

  const userNameById = new Map<number, string>();
  for (const user of users as Array<{ id?: unknown; username?: unknown }>) {
    const id = toPositiveIntFromUnknown(user.id);
    if (!id) continue;

    const username = asString(user.username);
    if (!username) continue;
    userNameById.set(id, username);
  }

  return userNameById;
};

export const resolveAuthorNameByFingerprint = async (
  fingerprint: unknown
): Promise<string> => {
  const userId = parseUserIdFromFingerprint(fingerprint);
  if (!userId) {
    return GUEST_AUTHOR_NAME;
  }

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    select: ['id', 'username'],
  });

  return asString((user as { username?: unknown } | null)?.username) || GUEST_AUTHOR_NAME;
};

export const buildAuthorNameMapByCommentId = async <
  TComment extends { id: number; userFingerprint?: unknown }
>(
  comments: TComment[]
): Promise<Map<number, string>> => {
  const userIds = Array.from(
    new Set(
      comments
        .map((comment) => parseUserIdFromFingerprint(comment.userFingerprint))
        .filter((value): value is number => value !== null)
    )
  );

  const userNameById = await resolveUserNameByIdMap(userIds);
  const authorNameByCommentId = new Map<number, string>();

  for (const comment of comments) {
    const userId = parseUserIdFromFingerprint(comment.userFingerprint);
    if (!userId) {
      authorNameByCommentId.set(comment.id, GUEST_AUTHOR_NAME);
      continue;
    }

    authorNameByCommentId.set(comment.id, userNameById.get(userId) || GUEST_AUTHOR_NAME);
  }

  return authorNameByCommentId;
};

export const buildAuthorNameMapByIdeaId = async <
  TIdea extends { id: number; authorFingerprint?: unknown }
>(
  ideas: TIdea[]
): Promise<Map<number, string>> => {
  const userIds = Array.from(
    new Set(
      ideas
        .map((idea) => parseUserIdFromFingerprint(idea.authorFingerprint))
        .filter((value): value is number => value !== null)
    )
  );

  const userNameById = await resolveUserNameByIdMap(userIds);
  const authorNameByIdeaId = new Map<number, string>();

  for (const idea of ideas) {
    const userId = parseUserIdFromFingerprint(idea.authorFingerprint);
    if (!userId) {
      authorNameByIdeaId.set(idea.id, GUEST_AUTHOR_NAME);
      continue;
    }

    authorNameByIdeaId.set(idea.id, userNameById.get(userId) || GUEST_AUTHOR_NAME);
  }

  return authorNameByIdeaId;
};
