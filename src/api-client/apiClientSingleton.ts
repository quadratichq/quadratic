import { GridFile, GridFileSchema } from '../schemas';
import * as Sentry from '@sentry/react';
import { downloadFile } from '../helpers/downloadFile';
import mixpanel from 'mixpanel-browser';
import { authClient } from '../auth';
import z from 'zod';
const API_URL = process.env.REACT_APP_QUADRATIC_API_URL;

// TODO share this code with API
export const APIFileSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  created_date: z.number(),
  updated_date: z.number(),
  // TODO pull these from the GridFilesSchema
  version: z.union([z.literal('1.0'), z.literal('1.1'), z.literal('1.2'), z.literal('1.3')]),
  // TODO one of <from API types>
  public_link_access: z.string(),
  // TODO guarantee this will be the _latest_
  contents: GridFileSchema,
});
export type APIFile = z.infer<typeof APIFileSchema>;
export const FileResSchema = {
  // TODO one of?
  permission: z.string(),
  file: APIFileSchema,
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
    if (!API_URL) {
      throw new Error('REACT_APP_QUADRATIC_API_URL not set');
    }
    return API_URL;
  }

  async getFiles(): Promise<GridFile[] | undefined> {
    try {
      const base_url = this.getAPIURL();
      const token = await authClient.getToken();
      const response = await fetch(`${base_url}/v0/files`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API Response Error: ${response.status} ${response.statusText}`);
      }
      const files: GridFile[] = await response.json();
      return files;
    } catch (error) {
      console.error(error);
      Sentry.captureException({
        message: `API Error Catch: Failed to fetch \`/files\`. ${error}`,
      });

      return undefined;
    }
  }

  // Fetch a file from the DB
  async getFile(id: string): Promise<GridFile | undefined> {
    // TODO should we hide the share button when that is not configured? (e.g. locally)
    if (!API_URL) return;

    try {
      const base_url = this.getAPIURL();
      const response = await fetch(`${base_url}/v0/files/${id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${await authClient.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API Response Error: ${response.status} ${response.statusText}`);
      }
      const file: GridFile = await response.json();

      return file;
    } catch (error) {
      console.error(error);
      Sentry.captureException({
        message: `API Error Catch: Failed to fetch \`/files\`. ${error}`,
      });
    }
  }

  async deleteFile(id: string): Promise<boolean> {
    if (!API_URL) return false;

    try {
      const base_url = this.getAPIURL();
      const response = await fetch(`${base_url}/v0/files/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${await authClient.getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`API Response Error: ${response.status} ${response.statusText}`);
      }
      return true;
    } catch (error) {
      console.error(error);
      Sentry.captureException({
        message: `API Error Catch: Failed to delete \`/files/${id}\`. ${error}`,
      });
      return false;
    }
  }

  async downloadFile(id: string): Promise<void> {
    mixpanel.track('[APIClient].downloadFile', { id });
    try {
      const file = await this.getFile(id);
      if (!file) {
        throw new Error('Failed to fetch file.');
      }
      // TODO types are wrong here
      // file.name is from the db, file.filename is in the filecontents
      // @ts-expect-error
      downloadFile(file.name, JSON.stringify(file));
    } catch (error) {
      console.error(error);
      Sentry.captureException({
        message: `API Error Catch: Failed to download \`/files/${id}\`. ${error}`,
      });
    }
  }

  async backupFile(id: string, fileContents: GridFile) {
    if (!API_URL) return;

    try {
      const base_url = this.getAPIURL();

      const request_body = {
        uuid: id,
        fileContents: JSON.stringify(fileContents),
      };

      const response = await fetch(`${base_url}/v0/files/${id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await authClient.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request_body),
      });

      if (!response.ok) {
        Sentry.captureException({
          message: `API Response Error: ${response.status} ${response.statusText}`,
        });
      }
    } catch (error: any) {
      Sentry.captureException({
        message: `API Error Catch: ${error}`,
      });
    }
  }

  async postFeedback({ feedback, userEmail }: { feedback: string; userEmail?: string }): Promise<boolean> {
    try {
      const url = `${this.getAPIURL()}/v0/feedback`;
      const body = JSON.stringify({ feedback, userEmail });
      const token = await authClient.getToken();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      if (!response.ok) {
        throw new Error(`Unexpected response: ${response.status} ${response.statusText}`);
      }
      return true;
    } catch (error) {
      Sentry.captureException({
        message: `API Error Catch \`/v0/feedback\`: ${error}`,
      });
      return false;
    }
  }

  async createFile(
    name?: string,
    contents: GridFile = {
      cells: [],
      formats: [],
      columns: [],
      rows: [],
      borders: [],
      cell_dependency: '',
      version: GridFileSchema.shape.version.value,
    }
  ): Promise<APIFile | undefined> {
    if (!API_URL) return;

    try {
      const base_url = this.getAPIURL();

      const response = await fetch(`${base_url}/v0/files/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await authClient.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          contents,
        }),
      });

      if (!response.ok) {
        Sentry.captureException({
          message: `API Response Error: ${response.status} ${response.statusText}`,
        });
      }

      // TODO: Verify that the response is what we expect
      return await response.json();
    } catch (error: any) {
      Sentry.captureException({
        message: `API Error Catch: ${error}`,
      });
    }
  }
}

export default APIClientSingleton.getInstance();
