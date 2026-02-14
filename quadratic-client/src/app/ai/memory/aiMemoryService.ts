import type { MemoryPayload } from '@/app/web-workers/quadraticCore/coreClientMessages';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { authClient } from '@/auth/auth';

const API_URL = import.meta.env.VITE_QUADRATIC_API_URL;

// Debounce state per file
const lastGenerationTime = new Map<string, number>();
const DEBOUNCE_MS = 60_000; // Minimum 1 minute between generations for the same file

/**
 * Extract a MemoryPayload from the current grid and send it to the API
 * for summarization and storage.
 */
export async function triggerMemoryGeneration(teamUuid: string, fileUuid: string): Promise<void> {
  // Debounce: skip if we generated for this file recently
  const now = Date.now();
  const lastTime = lastGenerationTime.get(fileUuid);
  if (lastTime && now - lastTime < DEBOUNCE_MS) {
    return;
  }
  lastGenerationTime.set(fileUuid, now);

  try {
    const payload = await quadraticCore.getMemoryPayload();
    if (!payload) return;

    // Skip empty files
    if (payload.sheets.length === 0 && payload.codeCells.length === 0) return;

    await sendMemoryPayload(teamUuid, fileUuid, payload);
  } catch (err) {
    console.error('[ai-memory] Failed to trigger memory generation:', err);
  }
}

async function sendMemoryPayload(teamUuid: string, fileUuid: string, payload: MemoryPayload): Promise<void> {
  const isAuthenticated = await authClient.isAuthenticated();
  if (!isAuthenticated) return;

  const token = await authClient.getTokenOrRedirect(true);

  const response = await fetch(`${API_URL}/v0/teams/${teamUuid}/ai/memories/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileUuid,
      payload,
    }),
  });

  if (!response.ok) {
    console.warn('[ai-memory] Memory generation request failed:', response.status);
  }
}

/**
 * Returns whether the given file has any AI memories (for this team).
 */
export async function fileHasMemories(teamUuid: string, fileUuid: string): Promise<boolean> {
  const isAuthenticated = await authClient.isAuthenticated();
  if (!isAuthenticated) return false;

  const token = await authClient.getTokenOrRedirect(true);
  const response = await fetch(
    `${API_URL}/v0/teams/${teamUuid}/ai/memories/has-file/${fileUuid}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) return false;
  const data = await response.json();
  return data.hasMemories === true;
}

export interface AiMemory {
  id: number;
  teamId: number;
  fileId: number | null;
  entityType: 'FILE' | 'CODE_CELL' | 'CONNECTION' | 'CHAT_INSIGHT';
  entityId: string | null;
  title: string;
  summary: string;
  metadata: Record<string, unknown>;
  pinned: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  similarity?: number;
}

/**
 * Search team memories by semantic query.
 */
export async function searchTeamMemories(
  teamUuid: string,
  query: string,
  options?: { limit?: number; entityType?: string; fileId?: number }
): Promise<AiMemory[]> {
  const isAuthenticated = await authClient.isAuthenticated();
  if (!isAuthenticated) return [];

  const token = await authClient.getTokenOrRedirect(true);

  const params = new URLSearchParams({ q: query });
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.entityType) params.set('entityType', options.entityType);
  if (options?.fileId) params.set('fileId', String(options.fileId));

  const response = await fetch(`${API_URL}/v0/teams/${teamUuid}/ai/memories/search?${params}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.warn('[ai-memory] Memory search request failed:', response.status);
    return [];
  }

  const data = await response.json();
  return data.memories;
}

/**
 * List team memories (paginated).
 */
export async function listTeamMemories(
  teamUuid: string,
  options?: { entityType?: string; fileId?: number; cursor?: number; limit?: number }
): Promise<{ memories: AiMemory[]; nextCursor: number | null }> {
  const isAuthenticated = await authClient.isAuthenticated();
  if (!isAuthenticated) return { memories: [], nextCursor: null };

  const token = await authClient.getTokenOrRedirect(true);

  const params = new URLSearchParams();
  if (options?.entityType) params.set('entityType', options.entityType);
  if (options?.fileId) params.set('fileId', String(options.fileId));
  if (options?.cursor) params.set('cursor', String(options.cursor));
  if (options?.limit) params.set('limit', String(options.limit));

  const response = await fetch(`${API_URL}/v0/teams/${teamUuid}/ai/memories?${params}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.warn('[ai-memory] Memory list request failed:', response.status);
    return { memories: [], nextCursor: null };
  }

  return response.json();
}

/**
 * Delete a memory.
 */
export async function deleteTeamMemory(teamUuid: string, memoryId: number): Promise<boolean> {
  const isAuthenticated = await authClient.isAuthenticated();
  if (!isAuthenticated) return false;

  const token = await authClient.getTokenOrRedirect(true);

  const response = await fetch(`${API_URL}/v0/teams/${teamUuid}/ai/memories/${memoryId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.ok;
}

/**
 * Update a memory (edit summary, pin/unpin).
 */
export async function updateTeamMemory(
  teamUuid: string,
  memoryId: number,
  updates: { title?: string; summary?: string; pinned?: boolean }
): Promise<AiMemory | null> {
  const isAuthenticated = await authClient.isAuthenticated();
  if (!isAuthenticated) return null;

  const token = await authClient.getTokenOrRedirect(true);

  const response = await fetch(`${API_URL}/v0/teams/${teamUuid}/ai/memories/${memoryId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) return null;
  return response.json();
}
