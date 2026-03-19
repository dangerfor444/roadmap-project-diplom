import type {
  ApiEnvelope,
  CreateCommentInput,
  CreateIdeaInput,
  IdeaComment,
  IdeaDetails,
  IdeaSort,
  IdeaSummary,
  RoadmapCommentCreateResult,
  RoadmapDetails,
  RoadmapItem,
  RoadmapStatus,
  RoadmapVoteResult,
  VoteResult,
} from '../types/public-api';
import { resolveWriteIdentity } from './write-auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:1337/api/public';
export const PUBLIC_WRITE_AUTH_REQUIRED_EVENT = 'public-write-auth-required';

const resolveUrl = (path: string): string => `${API_BASE_URL}${path}`;

const notifyWriteAuthRequired = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PUBLIC_WRITE_AUTH_REQUIRED_EVENT));
};

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;
  readonly isAuthRequired: boolean;

  constructor(
    message: string,
    status: number,
    retryAfterSeconds: number | null = null,
    isAuthRequired = false
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.isAuthRequired = isAuthRequired;
  }
}

export const isAuthRequiredError = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.isAuthRequired;

const asErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const payloadObj = payload as Record<string, unknown>;

  if (typeof payloadObj.error === 'string') {
    return payloadObj.error;
  }

  if (payloadObj.error && typeof payloadObj.error === 'object') {
    const nested = payloadObj.error as Record<string, unknown>;
    if (typeof nested.message === 'string') {
      return nested.message;
    }
  }

  if (typeof payloadObj.message === 'string') {
    return payloadObj.message;
  }

  return null;
};

const isWriteMethod = (method?: string): boolean => {
  const normalized = String(method ?? 'GET').trim().toUpperCase();
  return normalized !== 'GET' && normalized !== 'HEAD' && normalized !== 'OPTIONS';
};

const isAuthRequiredMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('authenticated actor token is required') ||
    normalized.includes('authenticated actor is required') ||
    normalized.includes('x-actor-token') ||
    normalized.includes('x-actor-id')
  );
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(resolveUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      asErrorMessage(payload) ??
      `Ошибка запроса: HTTP ${response.status}`;
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterValue = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
    const retryAfterSeconds = Number.isFinite(retryAfterValue) ? retryAfterValue : null;
    const authRequired =
      isWriteMethod(init?.method) &&
      (response.status === 400 || response.status === 401 || response.status === 403) &&
      isAuthRequiredMessage(message);

    if (authRequired) {
      notifyWriteAuthRequired();
    }

    throw new ApiError(message, response.status, retryAfterSeconds, authRequired);
  }

  return payload as T;
};

export const publicApi = {
  async getRoadmap(status: RoadmapStatus | 'all'): Promise<RoadmapItem[]> {
    const query = status === 'all' ? '' : `?status=${status}`;
    const response = await request<ApiEnvelope<RoadmapItem[]>>(`/roadmap${query}`);
    return response.data;
  },

  async getRoadmapDetails(id: number): Promise<RoadmapDetails> {
    const response = await request<ApiEnvelope<RoadmapDetails>>(`/roadmap/${id}`);
    return response.data;
  },

  async voteRoadmapItem(id: number, userFingerprint: string): Promise<RoadmapVoteResult> {
    const identity = resolveWriteIdentity(userFingerprint);
    const body: Record<string, unknown> = {};
    if (identity.userFingerprint) {
      body.userFingerprint = identity.userFingerprint;
    }

    const response = await request<ApiEnvelope<RoadmapVoteResult>>(`/roadmap/${id}/vote`, {
      method: 'POST',
      headers: identity.headers,
      body: JSON.stringify(body),
    });
    return response.data;
  },

  async unvoteRoadmapItem(id: number, userFingerprint: string): Promise<RoadmapVoteResult> {
    const identity = resolveWriteIdentity(userFingerprint);
    const body: Record<string, unknown> = {};
    if (identity.userFingerprint) {
      body.userFingerprint = identity.userFingerprint;
    }

    const response = await request<ApiEnvelope<RoadmapVoteResult>>(`/roadmap/${id}/vote`, {
      method: 'DELETE',
      headers: identity.headers,
      body: JSON.stringify(body),
    });
    return response.data;
  },

  async createRoadmapComment(id: number, input: CreateCommentInput): Promise<RoadmapCommentCreateResult> {
    const identity = resolveWriteIdentity(input.userFingerprint);
    const body: Record<string, unknown> = {
      text: input.text,
    };
    if (identity.userFingerprint) {
      body.userFingerprint = identity.userFingerprint;
    }

    const response = await request<ApiEnvelope<RoadmapCommentCreateResult>>(`/roadmap/${id}/comments`, {
      method: 'POST',
      headers: identity.headers,
      body: JSON.stringify(body),
    });
    return response.data;
  },

  async getIdeas(sort: IdeaSort): Promise<IdeaSummary[]> {
    const response = await request<ApiEnvelope<IdeaSummary[]>>(`/ideas?sort=${sort}`);
    return response.data;
  },

  async getIdeaDetails(id: number): Promise<IdeaDetails> {
    const response = await request<ApiEnvelope<IdeaDetails>>(`/ideas/${id}`);
    return response.data;
  },

  async createIdea(input: CreateIdeaInput): Promise<IdeaSummary> {
    const identity = resolveWriteIdentity(input.userFingerprint);
    const body: Record<string, unknown> = {
      title: input.title,
      description: input.description,
    };
    if (identity.userFingerprint) {
      body.userFingerprint = identity.userFingerprint;
    }

    const response = await request<ApiEnvelope<IdeaSummary>>('/ideas', {
      method: 'POST',
      headers: identity.headers,
      body: JSON.stringify(body),
    });
    return response.data;
  },

  async voteIdea(id: number, userFingerprint: string): Promise<VoteResult> {
    const identity = resolveWriteIdentity(userFingerprint);
    const body: Record<string, unknown> = {};
    if (identity.userFingerprint) {
      body.userFingerprint = identity.userFingerprint;
    }

    const response = await request<ApiEnvelope<VoteResult>>(`/ideas/${id}/vote`, {
      method: 'POST',
      headers: identity.headers,
      body: JSON.stringify(body),
    });
    return response.data;
  },

  async unvoteIdea(id: number, userFingerprint: string): Promise<VoteResult> {
    const identity = resolveWriteIdentity(userFingerprint);
    const body: Record<string, unknown> = {};
    if (identity.userFingerprint) {
      body.userFingerprint = identity.userFingerprint;
    }

    const response = await request<ApiEnvelope<VoteResult>>(`/ideas/${id}/vote`, {
      method: 'DELETE',
      headers: identity.headers,
      body: JSON.stringify(body),
    });
    return response.data;
  },

  async createComment(id: number, input: CreateCommentInput): Promise<IdeaComment> {
    const identity = resolveWriteIdentity(input.userFingerprint);
    const body: Record<string, unknown> = {
      text: input.text,
    };
    if (identity.userFingerprint) {
      body.userFingerprint = identity.userFingerprint;
    }

    const response = await request<ApiEnvelope<IdeaComment>>(`/ideas/${id}/comments`, {
      method: 'POST',
      headers: identity.headers,
      body: JSON.stringify(body),
    });
    return response.data;
  },
};
