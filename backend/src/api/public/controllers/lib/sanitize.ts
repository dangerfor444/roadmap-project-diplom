import { asString } from './utils';

const asCount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  return 0;
};

const sanitizeAuthorName = (value: unknown): string => asString(value) || 'Guest';

export const sanitizeIdea = (idea: any) => ({
  id: idea.id,
  documentId: idea.documentId,
  title: idea.title,
  description: idea.description,
  status: idea.status,
  votesCount: asCount(idea.votesCount),
  commentsCount: asCount(idea.commentsCount),
  authorName: sanitizeAuthorName(idea.authorName),
  createdAt: idea.createdAt,
});

export const sanitizeRoadmapItem = (item: any) => ({
  id: item.id,
  documentId: item.documentId,
  title: item.title,
  description: item.description,
  status: item.status,
  category: item.category,
  votesCount: asCount(item.votesCount),
  commentsCount: asCount(item.commentsCount),
  createdAt: item.createdAt,
});

export const sanitizeComment = (comment: any) => ({
  id: comment.id,
  text: comment.text,
  createdAt: comment.createdAt,
  authorName: sanitizeAuthorName(comment.authorName),
});

export const sanitizeRoadmapComment = (comment: any) => ({
  id: comment.id,
  text: comment.text,
  createdAt: comment.createdAt,
  authorName: sanitizeAuthorName(comment.authorName),
});
