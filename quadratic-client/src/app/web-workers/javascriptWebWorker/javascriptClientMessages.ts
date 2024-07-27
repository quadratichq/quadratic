import type { CodeRun } from '@/app/web-workers/CodeRun';

export interface JavascriptClientLoadError {
  type: 'javascriptClientLoadError';
  error?: string;
}

export interface JavascriptClientState {
  type: 'javascriptClientState';
  state: 'loading' | 'ready' | 'error' | 'running';

  // current cell being executed
  current?: CodeRun;

  // cells awaiting execution
  awaitingExecution?: CodeRun[];

  // error loading Javascript
  error?: string;

  // used on initial load to set Javascript version
  version?: string;
}

export interface ClientJavascriptCoreChannel {
  type: 'clientJavascriptCoreChannel';
}

export interface JavascriptClientInit {
  type: 'javascriptClientInit';
  version: string;
}

export type JavascriptClientMessage = JavascriptClientLoadError | JavascriptClientState | JavascriptClientInit;

export type ClientJavascriptMessage = ClientJavascriptCoreChannel;
