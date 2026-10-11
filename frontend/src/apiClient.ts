import type { QueryRequest, QueryResponse, SchemaResponse, NodeDetail, RelatedNodesResponse } from './types';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errDetail: unknown;
    try {
      errDetail = await response.json();
    } catch {
      errDetail = await response.text();
    }
    const message = (errDetail && typeof errDetail === 'object' && 'detail' in errDetail)
      ? String((errDetail as { detail: unknown }).detail)
      : `HTTP ${response.status} ${response.statusText}`;
    throw new ApiError(response.status, message, errDetail);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  async runQuery(req: QueryRequest): Promise<QueryResponse> {
    return request<QueryResponse>('/query', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getSchema(): Promise<SchemaResponse> {
    return request<SchemaResponse>('/schema');
  },

  async getNode(id: string): Promise<NodeDetail> {
    return request<NodeDetail>(`/nodes/${encodeURIComponent(id)}`);
  },

  async getRelatedNodes(
    id: string,
    relationType: string,
    direction: 'incoming' | 'outgoing' = 'outgoing',
    limit = 50,
    offset = 0
  ): Promise<RelatedNodesResponse> {
    const params = new URLSearchParams({
      direction,
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return request<RelatedNodesResponse>(`/nodes/${encodeURIComponent(id)}/relations/${encodeURIComponent(relationType)}?${params}`);
  },

  async checkHealth(): Promise<{ status: string }> {
    return request<{ status: string }>('/health');
  },
};
