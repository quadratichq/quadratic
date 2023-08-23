import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { downloadFileInBrowser } from '../helpers/downloadFileInBrowser';
import { GridFile, GridFileSchema } from '../schemas';
import { fetchFromApi } from './fetchFromApi';
import {
  DeleteFileRes,
  DeleteFileResSchema,
  GetFileRes,
  GetFileResSchema,
  GetFilesRes,
  GetFilesResSchema,
  PostFeedbackReq,
  PostFeedbackRes,
  PostFeedbackResSchema,
  PostFileReq,
  PostFileRes,
  PostFileResSchema,
  PostFilesReq,
  PostFilesRes,
  PostFilesResSchema,
} from './types';

const DEFAULT_FILE: GridFile = {
  cells: [],
  formats: [],
  columns: [],
  rows: [],
  borders: [],
  cell_dependency: '',
  version: GridFileSchema.shape.version.value,
};

export const apiClient = {
  async getFiles() {
    return fetchFromApi<GetFilesRes>(`/v0/files`, { method: 'GET' }, GetFilesResSchema);
  },

  async getFile(uuid: string) {
    return fetchFromApi<GetFileRes>(`/v0/files/${uuid}`, { method: 'GET' }, GetFileResSchema);
  },

  async createFile(
    body: PostFilesReq = {
      name: 'Untitled',
      contents: JSON.stringify(DEFAULT_FILE),
      version: DEFAULT_FILE.version,
    }
  ) {
    return fetchFromApi<PostFilesRes>(`/v0/files/`, { method: 'POST', body: JSON.stringify(body) }, PostFilesResSchema);
  },

  async downloadFile(uuid: string) {
    mixpanel.track('[Files].downloadFile', { id: uuid });
    return this.getFile(uuid).then((json) => downloadFileInBrowser(json.file.name, json.file.contents));
  },

  async deleteFile(uuid: string) {
    mixpanel.track('[Files].deleteFile', { id: uuid });
    return fetchFromApi<DeleteFileRes>(`/v0/files/${uuid}`, { method: 'DELETE' }, DeleteFileResSchema);
  },

  async updateFile(uuid: string, body: PostFileReq) {
    return fetchFromApi<PostFileRes>(
      `/v0/files/${uuid}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      PostFileResSchema
    );
  },

  async postFeedback(body: PostFeedbackReq) {
    return fetchFromApi<PostFeedbackRes>(
      `/v0/feedback`,
      { method: 'POST', body: JSON.stringify(body) },
      PostFeedbackResSchema
    );
  },

  getApiUrl() {
    const url = process.env.REACT_APP_QUADRATIC_API_URL;
    if (!url) {
      const message = 'REACT_APP_QUADRATIC_API_URL env variable is not set.';
      Sentry.captureEvent({
        message,
        level: Sentry.Severity.Fatal,
      });
      throw new Error(message);
    }

    return url;
  },

  // Someday: figure out how to fit in the calls for the AI chat
};
