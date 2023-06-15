import { Auth0ContextInterface } from '@auth0/auth0-react';
import { GridFile } from '../schemas';
import * as Sentry from '@sentry/react';

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
    if (!process.env.REACT_APP_QUADRATIC_API_URL) {
      throw new Error('REACT_APP_QUADRATIC_API_URL not set');
    }
    return process.env.REACT_APP_QUADRATIC_API_URL;
  }

  async backupFile(id: string, fileContents: GridFile) {
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

  async postFeedback(feedback: string): Promise<boolean> {
    try {
      const url = `${this.getAPIURL()}/v0/feedback`;
      const body = JSON.stringify({ feedback });
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
