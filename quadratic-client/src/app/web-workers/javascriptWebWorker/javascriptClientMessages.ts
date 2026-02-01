export interface JavascriptClientLoadError {
  type: 'javascriptClientLoadError';
  error?: string;
}

export interface JavascriptClientState {
  type: 'javascriptClientState';
  state: 'loading' | 'ready' | 'error' | 'running';

  // error loading Javascript
  error?: string;

  // used on initial load to set Javascript version
  version?: string;
}

export interface JavascriptClientInit {
  type: 'javascriptClientInit';
  version: string;
}

export interface ClientJavascriptCoreChannel {
  type: 'clientJavascriptCoreChannel';
  env: ImportMetaEnv;
  isEmbedMode: boolean;
}

export interface ClientJavascriptGetJwt {
  type: 'clientJavascriptGetJwt';
  id: number;
  jwt: string;
}

export interface JavascriptClientGetJwt {
  type: 'javascriptClientGetJwt';
  id: number;
}

export type JavascriptClientMessage =
  | JavascriptClientLoadError
  | JavascriptClientState
  | JavascriptClientInit
  | JavascriptClientGetJwt;

export type ClientJavascriptMessage = ClientJavascriptCoreChannel | ClientJavascriptGetJwt;
