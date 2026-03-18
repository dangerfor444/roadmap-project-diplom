import type { IdeaStatus, RoadmapStatus } from './public-api';

export type ManagerCommentTarget = 'idea' | 'roadmap';

export interface ManagerRoadmapItem {
  id: number;
  documentId: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  category: string | null;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerIdeaItem {
  id: number;
  documentId: string;
  title: string;
  description: string;
  status: IdeaStatus;
  votesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerCommentItem {
  id: number;
  target: ManagerCommentTarget;
  parentId: number | null;
  parentTitle: string | null;
  parentStatus: string | null;
  parentExists: boolean;
  text: string;
  isHidden: boolean;
  authorName: string;
  userFingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerCreateRoadmapInput {
  title: string;
  description: string;
  status: RoadmapStatus;
  category?: string | null;
}

export interface ManagerUpdateRoadmapInput {
  title?: string;
  description?: string;
  status?: RoadmapStatus;
  category?: string | null;
}

export interface ManagerCommentsFilter {
  target?: ManagerCommentTarget;
  isHidden?: boolean;
}

export interface ManagerApiEnvelope<T> {
  data: T;
}
