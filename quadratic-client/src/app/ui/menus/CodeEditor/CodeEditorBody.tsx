import { hasPermissionToEditFile } from '@/app/actions';
import {
  codeEditorCodeCellAtom,
  codeEditorDiffEditorContentAtom,
  codeEditorEditorContentAtom,
  codeEditorLoadingAtom,
  codeEditorShowCodeEditorAtom,
  codeEditorShowDiffEditorAtom,
} from '@/app/atoms/codeEditorAtom';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { events } from '@/app/events/events';
import { codeCellIsAConnection, getLanguageForMonaco } from '@/app/helpers/codeCellLanguage';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { provideCompletionItems, provideHover } from '@/app/quadratic-core/quadratic_core';
import { isSameCodeCell, type CodeCell } from '@/app/shared/types/codeCell';
import type { SuggestController } from '@/app/shared/types/SuggestController';
import { CodeEditorPlaceholder } from '@/app/ui/menus/CodeEditor/CodeEditorPlaceholder';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from '@/app/ui/menus/CodeEditor/FormulaLanguageModel';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import { useCodeEditorCompletions } from '@/app/ui/menus/CodeEditor/hooks/useCodeEditorCompletions';
import { useEditorCellHighlights } from '@/app/ui/menus/CodeEditor/hooks/useEditorCellHighlights';
import { useEditorReturn } from '@/app/ui/menus/CodeEditor/hooks/useEditorReturn';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import {
  provideCompletionItems as provideCompletionItemsPython,
  provideHover as provideHoverPython,
  provideSignatureHelp as provideSignatureHelpPython,
} from '@/app/ui/menus/CodeEditor/PythonLanguageModel';
import { QuadraticEditorTheme } from '@/app/ui/menus/CodeEditor/quadraticEditorTheme';
import { javascriptLibraryForEditor } from '@/app/web-workers/javascriptWebWorker/worker/javascript/runner/generatedJavascriptForEditor';
import { pyrightWorker, uri } from '@/app/web-workers/pythonLanguageServer/worker';
import { SpinnerIcon } from '@/shared/components/Icons';
import useEventListener from '@/shared/hooks/useEventListener';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import type { Monaco } from '@monaco-editor/react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

interface CodeEditorBodyProps {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
  setEditorInst: React.Dispatch<React.SetStateAction<monaco.editor.IStandaloneCodeEditor | null>>;
}

const AI_COMPLETION_DEBOUNCE_TIME_MS = 300;

// need to track globally since monaco is a singleton
const registered: Record<Extract<CodeCellLanguage, string>, boolean> = {
  Formula: false,
  Python: false,
  Javascript: false,
  Import: false,
};

export const CodeEditorBody = memo((props: CodeEditorBodyProps) => {
  const { debug } = useDebugFlags();

  const { editorInst, setEditorInst } = props;
  const showCodeEditor = useRecoilValue(codeEditorShowCodeEditorAtom);
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);
  const monacoLanguage = useMemo(() => getLanguageForMonaco(codeCell.language), [codeCell.language]);
  const isConnection = useMemo(() => codeCellIsAConnection(codeCell.language), [codeCell.language]);
  const [editorContent, setEditorContent] = useRecoilState(codeEditorEditorContentAtom);
  const { getAICompletion } = useCodeEditorCompletions({ language: codeCell.language });
  const showDiffEditor = useRecoilValue(codeEditorShowDiffEditorAtom);
  const diffEditorContent = useRecoilValue(codeEditorDiffEditorContentAtom);
  const loading = useRecoilValue(codeEditorLoadingAtom);
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();

  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEdit = useMemo(
    () => hasPermissionToEditFile(permissions) && (isConnection ? teamPermissions?.includes('TEAM_EDIT') : true),
    [isConnection, permissions, teamPermissions]
  );

  const [isValidRef, setIsValidRef] = useState(false);
  const [monacoInst, setMonacoInst] = useState<Monaco | null>(null);
  useEditorCellHighlights(isValidRef, editorInst, monacoInst);
  useEditorReturn(isValidRef, editorInst, monacoInst);

  const { closeEditor } = useCloseCodeEditor({
    editorInst,
  });

  useEffect(() => {
    if (editorInst) {
      // focus editor on show editor change
      editorInst.focus();
      editorInst.setPosition({ lineNumber: 0, column: 0 });
    }
  }, [editorInst, showCodeEditor]);

  useEffect(() => {
    const insertText = (text: string) => {
      if (!editorInst) return;
      const line = editorInst.getPosition();
      if (!line) return;
      const selection = editorInst.getSelection();
      const range = new monaco.Range(line.lineNumber, line.column, line.lineNumber, line.column);
      const id = { major: 1, minor: 1 };
      const op = { identifier: id, range: selection || range, text: text, forceMoveMarkers: true };
      editorInst.executeEdits('insertCelRef', [op]);
      editorInst.focus();
    };
    events.on('insertCodeEditorText', insertText);
    return () => {
      events.off('insertCodeEditorText', insertText);
    };
  }, [editorInst]);

  const lastLocation = useRef<CodeCell | undefined>(undefined);
  // This is to clear monaco editor's undo/redo stack when the cell location
  // changes useEffect gets triggered when the cell location changes, but the
  // editor content is not loaded in the editor new editor content for the next
  // cell also creates a undo stack entry setTimeout of 250ms is to ensure that
  // the new editor content is loaded, before we clear the undo/redo stack
  useEffect(() => {
    if (!editorInst) return;

    const model = editorInst.getModel();
    if (!model) return;

    if (lastLocation.current && isSameCodeCell(lastLocation.current, codeCell)) {
      return;
    }
    lastLocation.current = codeCell;

    setTimeout(() => {
      (model as any)?._commandManager?.clear();
    }, 250);
  }, [editorInst, codeCell.sheetId, codeCell.pos.x, codeCell.pos.y, codeCell]);

  const addCommands = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editor.addCommand(
        monaco.KeyCode.Escape,
        () => closeEditor(false),
        '!findWidgetVisible && !inReferenceSearchEditor && !editorHasSelection && !suggestWidgetVisible && !inlineSuggestionVisible'
      );
      editor.addCommand(monaco.KeyCode.KeyL | monaco.KeyMod.CtrlCmd, () => {
        insertCellRef(codeCell.sheetId, codeCell.language);
      });
    },
    [closeEditor, codeCell.language, codeCell.sheetId]
  );

  const runEditorAction = useCallback((e: CustomEvent<string>) => editorInst?.getAction(e.detail)?.run(), [editorInst]);
  useEventListener('run-editor-action', runEditorAction);

  const onMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      setEditorInst((prev) => {
        prev?.dispose();
        return editor;
      });
      setMonacoInst(monaco);
      setIsValidRef(true);

      editor.focus();

      monaco.editor.defineTheme('quadratic', QuadraticEditorTheme);
      monaco.editor.setTheme('quadratic');

      addCommands(editor, monaco);
      // this adds a cursor when the editor is not focused (useful when using insertCellRef button)
      const decorationCollection = editor.createDecorationsCollection();

      let position: monaco.Position | null = null;

      const updateCursorIndicator = () => {
        position = editor.getPosition();
      };

      const hideCursorIndicator = () => decorationCollection.set([]);

      const showCursorIndicator = () => {
        if (!position) return;

        // Define the decoration that represents the visual indicator
        const decoration = {
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
          options: {
            isWholeLine: false,
            className: 'w-0',
            before: {
              content: ' ',
              backgroundColor: 'transparent',
              inlineClassName: 'inline-block w-cursor bg-black h-full',
              inlineClassNameAffectsLetterSpacing: false,
            },
          },
        };

        // Update the decoration collection
        decorationCollection.set([decoration]);
      };

      editor.onDidChangeCursorPosition(updateCursorIndicator);
      editor.onDidFocusEditorText(hideCursorIndicator);
      editor.onDidBlurEditorText(showCursorIndicator);

      // Only register language once
      if (monacoLanguage === 'formula' && !registered.Formula) {
        monaco.languages.register({ id: 'formula' });
        monaco.languages.setLanguageConfiguration('formula', FormulaLanguageConfig);
        monaco.languages.setMonarchTokensProvider('formula', FormulaTokenizerConfig);
        monaco.languages.registerCompletionItemProvider('formula', {
          provideCompletionItems,
        });
        monaco.languages.registerHoverProvider('formula', { provideHover });
        registered.Formula = true;
      }

      if (monacoLanguage === 'python' && !registered.Python) {
        monaco.languages.register({ id: 'python' });
        monaco.languages.registerCompletionItemProvider('python', {
          provideCompletionItems: provideCompletionItemsPython,
          triggerCharacters: ['.', '[', '"', "'"],
        });
        monaco.languages.registerSignatureHelpProvider('python', {
          provideSignatureHelp: provideSignatureHelpPython,
          signatureHelpTriggerCharacters: ['(', ','],
        });
        monaco.languages.registerHoverProvider('python', { provideHover: provideHoverPython });

        // load the document in the python language server
        pyrightWorker?.openDocument({
          textDocument: { text: editor.getValue() ?? '', uri, languageId: 'python' },
        });
        registered.Python = true;
      }

      if (monacoLanguage === 'javascript' && !registered.Javascript) {
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          diagnosticCodesToIgnore: [1108, 1375, 1378],
        });
        monaco.editor.createModel(javascriptLibraryForEditor, 'javascript');
        registered.Javascript = true;
      }

      // Add ai assistant completion provider
      let completionTimeoutAndController: {
        timeout: NodeJS.Timeout | undefined; // to debounce the completion request
        abortController: AbortController | null; // to abort the completion api request
      } = {
        timeout: undefined,
        abortController: null,
      };

      const suggestionWidget = (editor.getContribution('editor.contrib.suggestController') as SuggestController | null)
        ?.widget;
      if (suggestionWidget) {
        clearTimeout(completionTimeoutAndController.timeout);
        completionTimeoutAndController.abortController?.abort();
      }

      const completionProvider = monaco.languages.registerInlineCompletionsProvider(monacoLanguage, {
        provideInlineCompletions: (
          model: monaco.editor.ITextModel,
          position: monaco.Position,
          _context: monaco.languages.InlineCompletionContext,
          token: monaco.CancellationToken
        ) => {
          // enabled in debug mode only
          if (!debug) return;

          return new Promise((resolve) => {
            clearTimeout(completionTimeoutAndController.timeout);
            completionTimeoutAndController.abortController?.abort();

            completionTimeoutAndController.timeout = setTimeout(async () => {
              try {
                completionTimeoutAndController.abortController = new AbortController();

                const value = model.getValue();
                if (!value) {
                  return resolve(null);
                }

                const prefix = model.getValueInRange({
                  startLineNumber: 1,
                  startColumn: 1,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                });

                const endLineNumber = model.getLineCount();
                const endColumn = model.getLineMaxColumn(endLineNumber);
                const suffix = model.getValueInRange({
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber,
                  endColumn,
                });

                const completion = await getAICompletion({
                  language: monacoLanguage,
                  prefix,
                  suffix,
                  signal: completionTimeoutAndController.abortController.signal,
                });

                if (!completion || token.isCancellationRequested) {
                  return resolve(null);
                }

                const result = {
                  items: [
                    {
                      insertText: completion,
                      range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column,
                      },
                    },
                  ],
                };
                resolve(result);
              } catch (error) {
                console.warn('[CodeEditorBody] Error fetching AI completion: ', error);
                resolve(null);
              }
            }, AI_COMPLETION_DEBOUNCE_TIME_MS);
          });
        },
        freeInlineCompletions: () => {
          clearTimeout(completionTimeoutAndController.timeout);
          completionTimeoutAndController.abortController?.abort();
        },
      });

      // Cleanup provider when editor is disposed
      editor.onDidDispose(() => {
        clearTimeout(completionTimeoutAndController.timeout);
        completionTimeoutAndController.abortController?.abort();
        completionProvider.dispose();
      });
    },
    [addCommands, debug, getAICompletion, monacoLanguage, setEditorInst]
  );

  const onChange = useCallback(
    (value: string | undefined) => {
      if (showDiffEditor) return;
      setEditorContent(value);
    },
    [setEditorContent, showDiffEditor]
  );

  const addCommandsDiff = useCallback(
    (editor: monaco.editor.IStandaloneDiffEditor, monaco: Monaco) => {
      editor.addCommand(
        monaco.KeyCode.Escape,
        () => closeEditor(false),
        '!findWidgetVisible && !inReferenceSearchEditor && !editorHasSelection && !suggestWidgetVisible'
      );
    },
    [closeEditor]
  );

  const onMountDiff = useCallback(
    (editor: monaco.editor.IStandaloneDiffEditor, monaco: Monaco) => {
      addCommandsDiff(editor, monaco);
    },
    [addCommandsDiff]
  );

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '2rem',
        flex: '2',
      }}
      className="dark-mode-hack"
    >
      {loading && (
        <div className="flex justify-center">
          <SpinnerIcon className="text-primary" />
        </div>
      )}

      <div className={`${!loading && !showDiffEditor ? 'h-full w-full' : 'h-0 w-0 opacity-0'}`}>
        <Editor
          height="100%"
          width="100%"
          language={monacoLanguage}
          value={editorContent}
          onChange={onChange}
          onMount={onMount}
          loading={<SpinnerIcon className="text-primary" />}
          options={{
            theme: 'light',
            readOnly: !canEdit,
            minimap: { enabled: true },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              horizontal: 'hidden',
            },
            wordWrap: 'on',
            fixedOverflowWidgets: true,

            // need to ignore unused b/c of the async wrapper around the code and import code
            showUnused: codeCell.language === 'Javascript' ? false : true,
          }}
        />
        <CodeEditorPlaceholder />
      </div>

      {!loading && showDiffEditor && (
        <div className="h-full w-full">
          <DiffEditor
            height="100%"
            width="100%"
            language={monacoLanguage}
            original={diffEditorContent?.isApplied ? diffEditorContent.editorContent : editorContent}
            originalLanguage={monacoLanguage}
            keepCurrentOriginalModel={true}
            modified={diffEditorContent?.isApplied ? editorContent : diffEditorContent?.editorContent}
            modifiedLanguage={monacoLanguage}
            keepCurrentModifiedModel={true}
            onMount={onMountDiff}
            loading={<SpinnerIcon className="text-primary" />}
            theme="light"
            options={{
              readOnly: true,
              minimap: { enabled: true },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              scrollbar: {
                horizontal: 'hidden',
              },
              wordWrap: 'on',

              // need to ignore unused b/c of the async wrapper around the code and import code
              showUnused: codeCell.language === 'Javascript' ? false : true,

              renderSideBySide: false,
            }}
          />
        </div>
      )}
    </div>
  );
});
