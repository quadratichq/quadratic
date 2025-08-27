import { fetchFromApi } from '@/shared/api/fetchFromApi';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';

export const scheduledTasksAPI = {
  /// Creates a new scheduled task
  create: (uuid: string, body: ApiTypes['/v0/files/:uuid/scheduled_task.POST.request']) => {
    return fetchFromApi(
      `/v0/files/${uuid}/scheduled_task`,
      { method: 'POST', body: JSON.stringify(body) },
      ApiSchemas['/v0/files/:uuid/scheduled_task.POST.response']
    );
  },

  /// Gets all scheduled tasks in a file
  get: (uuid: string): Promise<ApiTypes['/v0/files/:uuid/scheduled_task.GET.response']> => {
    return fetchFromApi(
      `/v0/files/${uuid}/scheduled_task`,
      { method: 'GET' },
      ApiSchemas['/v0/files/:uuid/scheduled_task.GET.response']
    );
  },
};
