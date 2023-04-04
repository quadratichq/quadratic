import { Auth0ContextInterface } from '@auth0/auth0-react';

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
}

export default APIClientSingleton.getInstance();
