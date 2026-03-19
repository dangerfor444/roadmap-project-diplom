export type RoadmapStatus = 'planned' | 'in_progress' | 'done';
export type IdeaStatus = 'new' | 'under_review' | 'planned' | 'declined' | 'done';
export type IdeaSort = 'popular' | 'discussed' | 'latest';

export interface RoadmapItem {
  id: number;
  documentId: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  category: string | null;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface RoadmapComment {
  id: number;
  text: string;
  createdAt: string;
  authorName: string;
}

export interface RoadmapDetails extends RoadmapItem {
  comments: RoadmapComment[];
}

export interface IdeaSummary {
  id: number;
  documentId: string;
  title: string;
  description: string;
  status: IdeaStatus;
  votesCount: number;
  commentsCount: number;
  authorName: string;
  createdAt: string;
}

export interface IdeaComment {
  id: number;
  text: string;
  createdAt: string;
  authorName: string;
}

export interface IdeaDetails extends IdeaSummary {
  comments: IdeaComment[];
}

export interface CreateIdeaInput {
  title: string;
  description: string;
  userFingerprint: string;
}

export interface CreateCommentInput {
  text: string;
  userFingerprint: string;
}

export interface VoteResult {
  ideaId: number;
  votesCount: number;
  voted: boolean;
}

export interface RoadmapVoteResult {
  roadmapItemId: number;
  votesCount: number;
  voted: boolean;
}

export interface RoadmapCommentCreateResult extends RoadmapComment {
  roadmapItemId: number;
  commentsCount: number;
}

export interface ApiEnvelope<T> {
  data: T;
}
