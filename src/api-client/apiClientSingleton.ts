import { Auth0ContextInterface } from '@auth0/auth0-react';
import { GridFile } from '../schemas';
import * as Sentry from '@sentry/react';
import { downloadFile } from '../helpers/downloadFile';
import mixpanel from 'mixpanel-browser';
const API_URL = process.env.REACT_APP_QUADRATIC_API_URL;

class APIClientSingleton {
  // Allow only one instance of the class to be created
  // gives access to the api all over the app including pure js
  private static instance: APIClientSingleton;
  private _getAccessTokenSilently: Auth0ContextInterface['getAccessTokenSilently'] | null;

  private constructor() {
    this._getAccessTokenSilently = null;
  }

  public static getInstance(): APIClientSingleton {
    if (!APIClientSingleton.instance) {
      APIClientSingleton.instance = new APIClientSingleton();
    }

    return APIClientSingleton.instance;
  }

  setAuth(_getAccessTokenSilently: Auth0ContextInterface['getAccessTokenSilently']): void {
    this._getAccessTokenSilently = _getAccessTokenSilently;
  }

  getAuth() {
    if (this._getAccessTokenSilently !== null) return this._getAccessTokenSilently();
    else throw new Error('Auth0 not initialized');
  }

  getAPIURL() {
    if (!API_URL) {
      throw new Error('REACT_APP_QUADRATIC_API_URL not set');
    }
    return API_URL;
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
          Authorization: `Bearer ${await this.getAuth()}`,
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

      const response = await fetch(`${base_url}/v0/files/backup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.getAuth()}`,
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
      const token = await this.getAuth();
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
}

export default APIClientSingleton.getInstance();
