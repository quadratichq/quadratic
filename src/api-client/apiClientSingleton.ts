import * as Sentry from '@sentry/react';
import { downloadFile } from 'helpers/downloadFile';
import mixpanel from 'mixpanel-browser';
import { authClient } from '../auth';
import { GridFile, GridFileSchema } from '../schemas';
import { GetFileRes, GetFilesRes, PostFileContentsReq, PostFileNameReq, PostFilesReq } from './types';

const API_URL = process.env.REACT_APP_QUADRATIC_API_URL;

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

  async getFiles(): Promise<GetFilesRes> {
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
      const files = await response.json();
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
  async getFile(id: string): Promise<GetFileRes | undefined> {
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

      return await response.json();
    } catch (error) {
      console.error(error);
      Sentry.captureException({
        message: `API Error Catch: Failed to fetch \`/files\`. ${error}`,
      });
    }
  }

  async deleteFile(id: string): Promise<boolean> {
    if (!API_URL) return false;
    mixpanel.track('[Files].deleteFile', { id });

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

  async downloadFile(id: string): Promise<boolean> {
    mixpanel.track('[APIClient].downloadFile', { id });
    try {
      const res = await this.getFile(id);
      if (!res) {
        throw new Error('Failed to fetch file.');
      }

      downloadFile(res.file.name, res.file.contents);
      return true;
    } catch (error) {
      console.error(error);
      Sentry.captureException({
        message: `API Error Catch: Failed to download \`/files/${id}\`. ${error}`,
      });
      return false;
    }
  }

  async postFile(uuid: string, body: PostFileContentsReq | PostFileNameReq): Promise<boolean> {
    try {
      const base_url = this.getAPIURL();
      const response = await fetch(`${base_url}/v0/files/${uuid}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await authClient.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        Sentry.captureException({
          message: `API Response Error: ${response.status} ${response.statusText}`,
        });
      }
      return true;
    } catch (error: any) {
      Sentry.captureException({
        message: `API Error Catch: ${error}`,
      });
      return false;
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

  /** Creates a new file and returns the new file's uuid */
  async createFile(name?: string, contents?: string): Promise<string | undefined> {
    if (!API_URL) return;
    mixpanel.track('[Files].newFile');

    const defaultContents: GridFile = {
      cells: [],
      formats: [],
      columns: [],
      rows: [],
      borders: [],
      cell_dependency: '',
      version: GridFileSchema.shape.version.value,
    };

    try {
      const base_url = this.getAPIURL();

      const body: PostFilesReq = {
        name,
        contents: contents ? contents : JSON.stringify(defaultContents),
      };

      const response = await fetch(`${base_url}/v0/files/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await authClient.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        Sentry.captureException({
          message: `API Response Error: ${response.status} ${response.statusText}`,
        });
      }

      // TODO: Verify that the response is what we expect and return the type
      // TODO document return type for create
      const json = await response.json();

      return json.uuid;
    } catch (error: any) {
      Sentry.captureException({
        message: `API Error Catch: ${error}`,
      });
    }
  }
}

export default APIClientSingleton.getInstance();
