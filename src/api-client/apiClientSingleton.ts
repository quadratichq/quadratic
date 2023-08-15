import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import z from 'zod';
import { authClient } from '../auth';
import { downloadFile } from '../helpers/downloadFile';
import { GridFile, GridFileSchema } from '../schemas';
import {
  DeleteFileRes,
  DeleteFileResSchema,
  GetFileRes,
  GetFileResSchema,
  GetFilesRes,
  GetFilesResSchema,
  PostFeedbackReq,
  PostFeedbackReqSchema,
  PostFileContentsReq,
  PostFileNameReq,
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

class APIClientSingleton {
  // Allow only one instance of the class to be created
  // gives access to the api all over the app including pure js
  private static instance: APIClientSingleton;

  public static getInstance(): APIClientSingleton {
    if (!APIClientSingleton.instance) {
      APIClientSingleton.instance = new APIClientSingleton();
    }

    return APIClientSingleton.instance;
  }

  getAPIURL() {
    if (!process.env.REACT_APP_QUADRATIC_API_URL) {
      throw new Error('REACT_APP_QUADRATIC_API_URL not set');
    }
    return process.env.REACT_APP_QUADRATIC_API_URL;
  }

  async getFiles(): Promise<GetFilesRes | undefined> {
    return safeFetch<GetFilesRes>(`/v0/files`, { method: 'GET' }, GetFilesResSchema);
  }

  // Fetch a file from the DB
  async getFile(id: string): Promise<GetFileRes | undefined> {
    return safeFetch<GetFileRes>(`/v0/files/${id}`, { method: 'GET' }, GetFileResSchema);
  }

  async deleteFile(id: string): Promise<boolean> {
    mixpanel.track('[Files].deleteFile', { id });
    return safeFetch<DeleteFileRes>(`/v0/files/${id}`, { method: 'DELETE' }, DeleteFileResSchema) // TODO
      .then(() => true)
      .catch(() => false);
  }

  async downloadFile(id: string): Promise<boolean> {
    mixpanel.track('[APIClient].downloadFile', { id });
    return this.getFile(id)
      .then((json) => {
        if (json) {
          downloadFile(json.file.name, json.file.contents);
          return true;
        } else {
          return false;
        }
      })
      .catch(() => false);
  }

  async postFile(uuid: string, body: PostFileContentsReq | PostFileNameReq): Promise<boolean> {
    return safeFetch<PostFileContentsReq | PostFileNameReq>(
      `/v0/files/${uuid}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      // TODO PostFileReqSchema
      z.object({ name: z.string() })
    )
      .then(() => true)
      .catch(() => false);
  }

  async postFeedback(body: PostFeedbackReq): Promise<boolean> {
    return safeFetch(`/v0/feedback`, { method: 'POST', body: JSON.stringify(body) }, PostFeedbackReqSchema)
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Create new file manually by passing its data, or create a blank file and
   * return the new file's UUID.
   */
  async createFile(
    body: PostFilesReq = {
      name: 'Untitled',
      contents: JSON.stringify(DEFAULT_FILE),
      version: DEFAULT_FILE.version,
    }
  ): Promise<string | undefined> {
    return safeFetch<PostFilesRes>(`/v0/files/`, { method: 'POST', body: JSON.stringify(body) }, PostFilesResSchema)
      .then((json) => json.uuid)
      .catch(() => undefined);
  }
}

export default APIClientSingleton.getInstance();

// Borrowed from: https://gist.github.com/gimenete/dd1886288ee3d3baaeae573ca226048f
export async function safeFetch<T>(path: string, init: RequestInit, schema: z.Schema<T>): Promise<T> {
  // Options shared amongst all fetches
  const baseUrl = APIClientSingleton.getInstance().getAPIURL();
  const token = await authClient.getToken();
  const defaultInit = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(baseUrl + path, { ...defaultInit, ...init });

  if (!response.ok) {
    const error = await newHTTPError('Unsuccessful response', response, init.method);
    throw error;
  }

  const json = await response.json().catch(async () => {
    const error = await newHTTPError('Not a JSON body', response, init.method);
    throw error;
  });

  const result = schema.safeParse(json);
  if (!result.success) {
    const error = await newHTTPError('Unexpected response schema', response, init.method);
    throw error;
  }

  return result.data;
}

async function newHTTPError(reason: string, response: Response, method?: string) {
  const text = await response.text().catch(() => null);
  const message = `Error fetching ${method} ${response.url} ${response.status}. ${reason}`;
  console.error(`${message}. Response body: ${text}`);
  Sentry.captureException({
    message,
  });
  return new Error(message);
}
