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
  isHidden: boolean;
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
  commentsCount: number;
  authorName: string;
  isHidden: boolean;
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

export interface ManagerRoadmapDetails extends ManagerRoadmapItem {
  comments: ManagerCommentItem[];
}

export interface ManagerIdeaDetails extends ManagerIdeaItem {
  comments: ManagerCommentItem[];
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

export interface ManagerApiEnvelope<T> {
  data: T;
}
