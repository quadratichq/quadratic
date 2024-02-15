import EventEmitter from "events";
import {
  CompletionList,
  CompletionParams,
  CompletionRequest,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentNotification,
  InitializedNotification,
  InitializeParams,
  InitializeRequest,
  LogMessageNotification,
  MessageConnection,
  PublishDiagnosticsNotification,
  PublishDiagnosticsParams,
  RegistrationRequest,
  ServerCapabilities,
  TextDocumentContentChangeEvent,
  TextDocumentItem,
} from "vscode-languageserver-protocol";

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
  /**
   * The capabilities of the server we're connected to.
   * Populated after initialize.
   */
  capabilities: ServerCapabilities | undefined;
  private versions: Map<string, number> = new Map();
  private diagnostics: Map<string, Diagnostic[]> = new Map();
  private initializePromise: Promise<void> | undefined;

  constructor(
    public connection: MessageConnection,
    public rootUri: string
  ) {
    super();
  }

  on(
    event: "diagnostics",
    listener: (params: PublishDiagnosticsParams) => void
  ): this {
    super.on(event, listener);
    return this;
  }

  currentDiagnostics(uri: string): Diagnostic[] {
    return this.diagnostics.get(uri) ?? [];
  }

  allDiagnostics(): Diagnostic[] {
    return Array.from(this.diagnostics.values()).flat();
  }

  errorCount(): number {
    return this.allDiagnostics().filter(
      (e) => e.severity === DiagnosticSeverity.Error
    ).length;
  }

  /**
   * Initialize or wait for in-progress initialization.
   */
  async initialize(): Promise<void> {
    if (this.initializePromise) {
      return this.initializePromise;
    }
    this.initializePromise = (async () => {
      this.connection.onNotification(LogMessageNotification.type, (params) =>
        console.log("[LS]", params.message)
      );

      this.connection.onNotification(
        PublishDiagnosticsNotification.type,
        (params) => {
          this.diagnostics.set(params.uri, params.diagnostics);
          // Republish as you can't listen twice.
          this.emit("diagnostics", params);
        }
      );
      this.connection.onRequest(RegistrationRequest.type, () => {
        // Ignore. I don't think we should get these at all given our
        // capabilities, but Pyright is sending one anyway.
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
                snippetSupport: false,
                commitCharactersSupport: true,
                documentationFormat: ["markdown"],
                deprecatedSupport: false,
                preselectSupport: false,
              },
              contextSupport: true,
            },
            signatureHelp: {
              signatureInformation: {
                documentationFormat: ["markdown"],
                activeParameterSupport: true,
                parameterInformation: {
                  labelOffsetSupport: true,
                },
              },
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
        initializationOptions: await this.getInitializationOptions(),
        processId: null,
        // Do we need both of these?
        rootUri: this.rootUri,
        workspaceFolders: [
          {
            name: "src",
            uri: this.rootUri,
          },
        ],
      };
      const { capabilities } = await this.connection.sendRequest(
        InitializeRequest.type,
        JSON.parse(JSON.stringify(initializeParams))
      );
      this.capabilities = capabilities;
      this.connection.sendNotification(InitializedNotification.type, {});
    })();
    return this.initializePromise;
  }

  private async getInitializationOptions(): Promise<any> {
    const files = await retryAsyncLoad(() => {
      return import('./typeshed.json');
    });

    return {
      files,
      diagnosticStyle: "simplified",
    };
  }

  didOpenTextDocument(params: {
    textDocument: Omit<TextDocumentItem, "version">;
  }): void {
    this.connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        ...params.textDocument,
        version: this.nextVersion(params.textDocument.uri),
      },
    });
  }

  // We close Python files that are deleted. We never write to the file system,
  // so that way they're effectively deleted.
  didCloseTextDocument(params: DidCloseTextDocumentParams): void {
    this.connection.sendNotification(
      DidCloseTextDocumentNotification.type,
      params
    );
  }

  didChangeTextDocument(
    uri: string,
    contentChanges: TextDocumentContentChangeEvent[]
  ): void {
    this.connection.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: {
        uri,
        version: this.nextVersion(uri),
      },
      contentChanges,
    });
  }

  async completionRequest(params: CompletionParams): Promise<CompletionList> {
    const results = await this.connection.sendRequest(
      CompletionRequest.type,
      params
    );
    if (!results) {
      // Not clear how this should be handled.
      return { items: [], isIncomplete: true };
    }
    return "items" in results
      ? results
      : { items: results, isIncomplete: true };
  }

  // async resolveCompletion(params: ResolveCompletionItemSignature): Promise<CompletionList> {
  //   const results = await this.connection.sendRequest(
  //     CompletionRequest.type,
  //     params
  //   );
  //   if (!results) {
  //     // Not clear how this should be handled.
  //     return { items: [], isIncomplete: true };
  //   }
  //   return "items" in results
  //     ? results
  //     : { items: results, isIncomplete: true };
  // }

  dispose() {
    this.connection.dispose();
  }

  private nextVersion(uri: string): number {
    const version = (this.versions.get(uri) ?? 0) + 1;
    this.versions.set(uri, version);
    return version;
  }
}

const defaultWaiter = (waitTime: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, waitTime));

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