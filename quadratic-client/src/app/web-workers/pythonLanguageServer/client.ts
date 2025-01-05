import EventEmitter from 'eventemitter3';
import type {
  CompletionList,
  CompletionParams,
  Diagnostic,
  DidCloseTextDocumentParams,
  Hover,
  HoverParams,
  InitializeParams,
  MessageConnection,
  PublishDiagnosticsParams,
  ServerCapabilities,
  SignatureHelp,
  SignatureHelpParams,
  TextDocumentContentChangeEvent,
  TextDocumentItem,
} from 'vscode-languageserver-protocol';
import {
  CompletionRequest,
  DiagnosticSeverity,
  DiagnosticTag,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  HoverRequest,
  InitializedNotification,
  InitializeRequest,
  PublishDiagnosticsNotification,
  SignatureHelpRequest,
} from 'vscode-languageserver-protocol';

/**
 * Create a URI for a source document under the default root of file:///src/.
 */
export const createUri = (name: string) => `file:///src/${name}`;

/**
 * Owns the connection.
 *
 * Exposes methods for the core text document notifications from
 * client to server for the app to implement.
 *
 * Tracks and exposes the diagnostics.
 */
export class LanguageServerClient extends EventEmitter {
  private serverCapabilities: ServerCapabilities | undefined;
  private versions: Map<string, number> = new Map();
  private diagnostics: Map<string, Diagnostic[]> = new Map();
  private initializePromise: Promise<void> | undefined;

  constructor(public connection: MessageConnection, public rootUri: string) {
    super();
  }

  on<T extends string | symbol>(event: T, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  onDiagnostics(listener: (params: PublishDiagnosticsParams) => void): this {
    return super.on('diagnostics', listener);
  }

  currentDiagnostics(uri: string): Diagnostic[] {
    return this.diagnostics.get(uri) ?? [];
  }

  allDiagnostics(): Diagnostic[] {
    return Array.from(this.diagnostics.values()).flat();
  }

  errorCount(): number {
    return this.allDiagnostics().filter((e) => e.severity === DiagnosticSeverity.Error).length;
  }

  /**
   * Initialize or wait for in-progress initialization.
   */
  async initialize(): Promise<void> {
    if (this.initializePromise) return this.initializePromise;

    this.initializePromise = (async () => {
      this.connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
        this.diagnostics.set(params.uri, params.diagnostics);
        window.dispatchEvent(new CustomEvent('python-diagnostics', { detail: params }));
        // Republish as you can't listen twice.
        this.emit('diagnostics', params);
      });

      const initializeParams: InitializeParams = {
        locale: 'en',
        capabilities: {
          textDocument: {
            moniker: {},
            synchronization: {
              willSave: false,
              didSave: false,
              willSaveWaitUntil: false,
            },
            completion: {
              completionItem: {
                snippetSupport: true,
                commitCharactersSupport: true,
                documentationFormat: ['markdown'],
                deprecatedSupport: false,
                preselectSupport: false,
              },
              contextSupport: true,
            },
            signatureHelp: {
              dynamicRegistration: true,
              signatureInformation: {
                documentationFormat: ['markdown'],
                activeParameterSupport: true,
                parameterInformation: {
                  labelOffsetSupport: true,
                },
              },
              contextSupport: true,
            },
            hover: {
              dynamicRegistration: true,
              contentFormat: ['markdown'],
            },
            publishDiagnostics: {
              tagSupport: {
                valueSet: [DiagnosticTag.Unnecessary, DiagnosticTag.Deprecated],
              },
            },
          },
          workspace: {
            workspaceFolders: true,
            didChangeConfiguration: {},
            configuration: true,
          },
        },
        // optional, but gives monaco more info about Python (i.e. better icons)
        initializationOptions: await this.initializationOptions(),
        processId: null,
        rootUri: this.rootUri,
        workspaceFolders: [
          {
            name: 'src',
            uri: this.rootUri,
          },
        ],
      };

      const { capabilities } = await this.connection.sendRequest(
        InitializeRequest.type,
        JSON.parse(JSON.stringify(initializeParams))
      );

      this.serverCapabilities = capabilities;
      this.connection.sendNotification(InitializedNotification.type, {});
    })();

    return this.initializePromise;
  }

  openDocument(params: { textDocument: Omit<TextDocumentItem, 'version'> }): void {
    this.connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        ...params.textDocument,
        version: this.nextVersion(params.textDocument.uri),
      },
    });
  }

  closeDocument(params: DidCloseTextDocumentParams): void {
    this.connection.sendNotification(DidCloseTextDocumentNotification.type, params);
  }

  changeDocument(uri: string, contentChanges: TextDocumentContentChangeEvent[]): void {
    this.connection.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: {
        uri,
        version: this.nextVersion(uri),
      },
      contentChanges,
    });
  }

  async completionRequest(params: CompletionParams): Promise<CompletionList> {
    const results = await this.connection.sendRequest(CompletionRequest.type, params);

    if (!results || !('items' in results)) {
      return { items: [], isIncomplete: true };
    }

    return results;
  }

  async signatureHelpRequest(params: SignatureHelpParams): Promise<SignatureHelp | null> {
    return this.connection.sendRequest(SignatureHelpRequest.type, params);
  }

  async hoverRequest(params: HoverParams): Promise<Hover | null> {
    return this.connection.sendRequest(HoverRequest.type, params);
  }

  dispose() {
    this.connection.dispose();
  }

  private async initializationOptions(): Promise<any> {
    const files = await retryAsyncLoad(() => {
      return import('./pyright-initialization.json');
    });

    return {
      files,
      diagnosticStyle: 'simplified',
    };
  }

  private nextVersion(uri: string): number {
    const version = (this.versions.get(uri) ?? 0) + 1;
    this.versions.set(uri, version);
    return version;
  }
}

const defaultWaiter = (waitTime: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, waitTime));

export const retryAsyncLoad = async <T>(
  load: () => Promise<T>,
  waiter: (waitTime: number) => Promise<void> = defaultWaiter
): Promise<T> => {
  let waitTime = 250;
  let attempts = 0;
  while (true) {
    try {
      // Must await here!
      return await load();
    } catch (e) {
      if (attempts === 4) {
        throw e;
      }
      await waiter(waitTime);
      attempts++;
      waitTime *= 3;
    }
  }
};
