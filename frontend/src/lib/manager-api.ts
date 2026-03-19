import type {
  ManagerApiEnvelope,
  ManagerCommentItem,
  ManagerCommentTarget,
  ManagerCreateRoadmapInput,
  ManagerIdeaDetails,
  ManagerIdeaItem,
  ManagerRoadmapDetails,
  ManagerRoadmapItem,
  ManagerUpdateRoadmapInput,
} from '../types/manager-api';
import type { IdeaStatus } from '../types/public-api';
import { getWidgetAuthSession } from './widget-auth-api';

const MANAGER_API_BASE_URL =
  import.meta.env.VITE_MANAGER_API_BASE_URL ?? 'http://localhost:1337/api/manager';

const resolveUrl = (path: string): string => `${MANAGER_API_BASE_URL}${path}`;

export class ManagerApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ManagerApiError';
    this.status = status;
  }
}

const asErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
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

const managerRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const session = getWidgetAuthSession();
  const jwt = session?.jwt?.trim() ?? '';

  if (!jwt) {
    throw new ManagerApiError('Требуется авторизация администратора.', 401);
  }

  const response = await fetch(resolveUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      asErrorMessage(payload) ?? `Ошибка API панели управления: HTTP ${response.status}`;
    throw new ManagerApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return payload as T;
};

export const managerApi = {
  async getRoadmap(): Promise<ManagerRoadmapItem[]> {
    const response = await managerRequest<ManagerApiEnvelope<ManagerRoadmapItem[]>>('/roadmap');
    return response.data;
  },

  async getRoadmapDetails(id: number): Promise<ManagerRoadmapDetails> {
    const response = await managerRequest<ManagerApiEnvelope<ManagerRoadmapDetails>>(
      `/roadmap/${id}`
    );
    return response.data;
  },

  async createRoadmap(input: ManagerCreateRoadmapInput): Promise<ManagerRoadmapItem> {
    const response = await managerRequest<ManagerApiEnvelope<ManagerRoadmapItem>>('/roadmap', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  async updateRoadmap(id: number, input: ManagerUpdateRoadmapInput): Promise<ManagerRoadmapItem> {
    const response = await managerRequest<ManagerApiEnvelope<ManagerRoadmapItem>>(
      `/roadmap/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      }
    );
    return response.data;
  },

  async updateRoadmapVisibility(id: number, isHidden: boolean): Promise<ManagerRoadmapItem> {
    const response = await managerRequest<ManagerApiEnvelope<ManagerRoadmapItem>>(
      `/roadmap/${id}/visibility`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isHidden }),
      }
    );
    return response.data;
  },

  async deleteRoadmap(id: number): Promise<void> {
    await managerRequest<void>(`/roadmap/${id}`, {
      method: 'DELETE',
    });
  },

  async getIdeas(status?: IdeaStatus): Promise<ManagerIdeaItem[]> {
    const query = status ? `?status=${status}` : '';
    const response = await managerRequest<ManagerApiEnvelope<ManagerIdeaItem[]>>(`/ideas${query}`);
    return response.data;
  },

  async getIdeaDetails(id: number): Promise<ManagerIdeaDetails> {
    const response = await managerRequest<ManagerApiEnvelope<ManagerIdeaDetails>>(`/ideas/${id}`);
    return response.data;
  },

  async updateIdeaStatus(id: number, status: IdeaStatus): Promise<ManagerIdeaItem> {
    const response = await managerRequest<ManagerApiEnvelope<ManagerIdeaItem>>(
      `/ideas/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
    return response.data;
  },

  async updateIdeaVisibility(id: number, isHidden: boolean): Promise<ManagerIdeaItem> {
    const response = await managerRequest<ManagerApiEnvelope<ManagerIdeaItem>>(
      `/ideas/${id}/visibility`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isHidden }),
      }
    );
    return response.data;
  },

  async deleteIdea(id: number): Promise<void> {
    await managerRequest<void>(`/ideas/${id}`, {
      method: 'DELETE',
    });
  },

  async moderateComment(
    target: ManagerCommentTarget,
    id: number,
    isHidden: boolean
  ): Promise<ManagerCommentItem> {
    const response = await managerRequest<ManagerApiEnvelope<ManagerCommentItem>>(
      `/comments/${target}/${id}/moderate`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isHidden }),
      }
    );
    return response.data;
  },

  async deleteComment(target: ManagerCommentTarget, id: number): Promise<void> {
    await managerRequest<void>(`/comments/${target}/${id}`, {
      method: 'DELETE',
    });
  },
};
