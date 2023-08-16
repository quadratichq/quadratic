import mixpanel from 'mixpanel-browser';
import { downloadFile as downloadFileOnClient } from '../helpers/downloadFile';
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
  PostFileContentsReq,
  PostFileNameReq,
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

async function getFiles() {
  return fetchFromApi<GetFilesRes>(`/v0/files`, { method: 'GET' }, GetFilesResSchema);
}

async function getFile(uuid: string) {
  return fetchFromApi<GetFileRes>(`/v0/files/${uuid}`, { method: 'GET' }, GetFileResSchema);
}

async function createFile(
  body: PostFilesReq = {
    name: 'Untitled',
    contents: JSON.stringify(DEFAULT_FILE),
    version: DEFAULT_FILE.version,
  }
) {
  return fetchFromApi<PostFilesRes>(`/v0/files/`, { method: 'POST', body: JSON.stringify(body) }, PostFilesResSchema);
}

async function downloadFile(uuid: string) {
  mixpanel.track('[Files].downloadFile', { id: uuid });
  return getFile(uuid).then((json) => downloadFileOnClient(json.file.name, json.file.contents));
}

async function deleteFile(uuid: string) {
  mixpanel.track('[Files].deleteFile', { id: uuid });
  return fetchFromApi<DeleteFileRes>(`/v0/files/${uuid}`, { method: 'DELETE' }, DeleteFileResSchema);
}

async function renameFile(uuid: string, body: PostFileNameReq) {
  return fetchFromApi<PostFileRes>(
    `/v0/files/${uuid}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    PostFileResSchema
  );
}

async function updateFile(uuid: string, body: PostFileContentsReq) {
  return fetchFromApi<PostFileRes>(
    `/v0/files/${uuid}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    PostFileResSchema
  );
}

async function postFeedback(body: PostFeedbackReq) {
  return fetchFromApi<PostFeedbackRes>(
    `/v0/feedback`,
    { method: 'POST', body: JSON.stringify(body) },
    PostFeedbackResSchema
  );
}

export const apiClient = {
  getFiles,
  getFile,
  createFile,
  downloadFile,
  deleteFile,
  renameFile,
  updateFile,
  postFeedback,
};
