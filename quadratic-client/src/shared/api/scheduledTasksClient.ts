import { fetchFromApi } from '@/shared/api/fetchFromApi';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';

export const scheduledTasksAPI = {
  /// Creates a new scheduled task
  create: (
    fileId: string,
    body: ApiTypes['/v0/files/:uuid/scheduled-tasks.POST.request']
  ): Promise<ApiTypes['/v0/files/:uuid/scheduled-tasks.POST.response']> => {
    return fetchFromApi(
      `/v0/files/${fileId}/scheduled-tasks`,
      { method: 'POST', body: JSON.stringify(body) },
      ApiSchemas['/v0/files/:uuid/scheduled-tasks.POST.response']
    );
  },

  /// Gets all scheduled tasks in a file
  get: (fileId: string): Promise<ApiTypes['/v0/files/:uuid/scheduled-tasks.GET.response']> => {
    return fetchFromApi(
      `/v0/files/${fileId}/scheduled-tasks`,
      { method: 'GET' },
      ApiSchemas['/v0/files/:uuid/scheduled-tasks.GET.response']
    );
  },

  update: (
    fileId: string,
    taskId: string,
    body: ApiTypes['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid.PATCH.request']
  ): Promise<ApiTypes['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid.PATCH.response']> => {
    return fetchFromApi(
      `/v0/files/${fileId}/scheduled-tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      ApiSchemas['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid.PATCH.response']
    );
  },

  delete: (
    fileId: string,
    taskId: string
  ): Promise<ApiTypes['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid.DELETE.response']> => {
    return fetchFromApi(
      `/v0/files/${fileId}/scheduled-tasks/${taskId}`,
      { method: 'DELETE' },
      ApiSchemas['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid.DELETE.response']
    );
  },

  history: (
    fileId: string,
    taskId: string,
    pageNumber: number,
    pageSize: number
  ): Promise<ApiTypes['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid/log.GET.response']> => {
    return fetchFromApi(
      `/v0/files/${fileId}/scheduled-tasks/${taskId}/log?page=${pageNumber}&limit=${pageSize}`,
      { method: 'GET' },
      ApiSchemas['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid/log.GET.response']
    );
  },
};
