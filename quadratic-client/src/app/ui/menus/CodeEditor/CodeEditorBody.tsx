import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { codeCellIsAConnection, getLanguageForMonaco } from '@/app/helpers/codeCellLanguage';
import { CodeCellLanguage, SheetRect } from '@/app/quadratic-core-types';
import { provideCompletionItems, provideHover } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { CodeEditorPlaceholder } from '@/app/ui/menus/CodeEditor/CodeEditorPlaceholder';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from '@/app/ui/menus/CodeEditor/FormulaLanguageModel';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import {
  provideCompletionItems as provideCompletionItemsPython,
  provideHover as provideHoverPython,
  provideSignatureHelp as provideSignatureHelpPython,
} from '@/app/ui/menus/CodeEditor/PythonLanguageModel';
import { QuadraticEditorTheme } from '@/app/ui/menus/CodeEditor/quadraticEditorTheme';
import { useEditorCellHighlights } from '@/app/ui/menus/CodeEditor/useEditorCellHighlights';
import { useEditorOnSelectionChange } from '@/app/ui/menus/CodeEditor/useEditorOnSelectionChange';
import { useEditorReturn } from '@/app/ui/menus/CodeEditor/useEditorReturn';
import { javascriptLibraryForEditor } from '@/app/web-workers/javascriptWebWorker/worker/javascript/runner/generatedJavascriptForEditor';
import { pyrightWorker, uri } from '@/app/web-workers/pythonLanguageServer/worker';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import useEventListener from '@/shared/hooks/useEventListener';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import Editor, { DiffEditor, Monaco } from '@monaco-editor/react';
import { CircularProgress } from '@mui/material';
import * as monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
// TODO(ddimaria): leave this as we're looking to add this back in once improved
// import { useEditorDiagnostics } from './useEditorDiagnostics';
// import { Diagnostic } from 'vscode-languageserver-types';
// import { typescriptLibrary } from '@/web-workers/javascriptWebWorker/worker/javascript/typescriptLibrary';

interface Props {
  editorContent?: string;
  setEditorContent: (value?: string) => void;
  closeEditor: (skipSaveCheck: boolean) => void;
  evaluationResult?: EvaluationResult;
  cellsAccessed?: SheetRect[] | null;
  cellLocation: SheetPosTS;
  modifiedEditorContent?: string;
  // TODO(ddimaria): leave this as we're looking to add this back in once improved
  // diagnostics?: Diagnostic[];
}

// need to track globally since monaco is a singleton
let registered: Record<Extract<CodeCellLanguage, string>, boolean> = {
  Formula: false,
  Python: false,
  Javascript: false,
};

export const CodeEditorBody = (props: Props) => {
  const {
    editorContent,
    setEditorContent,
    closeEditor,
    evaluationResult,
    cellsAccessed,
    cellLocation,
    modifiedEditorContent,
  } = props;
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const language = editorInteractionState.mode;
  const monacoLanguage = getLanguageForMonaco(language);
  const isConnection = codeCellIsAConnection(language);
  const canEdit =
    hasPermissionToEditFile(editorInteractionState.permissions) &&
    (isConnection ? teamPermissions?.includes('TEAM_EDIT') : true);
  const [didMount, setDidMount] = useState(false);
  const [isValidRef, setIsValidRef] = useState(false);
  const { editorRef, monacoRef } = useCodeEditor();

  useEditorCellHighlights(isValidRef, editorRef, monacoRef, language, cellsAccessed);
  useEditorOnSelectionChange(isValidRef, editorRef, monacoRef, language);
  useEditorReturn(isValidRef, editorRef, monacoRef, language, evaluationResult);

  // TODO(ddimaria): leave this as we're looking to add this back in once improved
  // useEditorDiagnostics(isValidRef, editorRef, monacoRef, language, diagnostics);

  useEffect(() => {
    if (editorInteractionState.showCodeEditor) {
      // focus editor on show editor change
      editorRef.current?.focus();
      editorRef.current?.setPosition({ lineNumber: 0, column: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorInteractionState.showCodeEditor]);

  useEffect(() => {
    const insertText = (text: string) => {
      if (!editorRef.current) return;
      const position = editorRef.current.getPosition();
      const model = editorRef.current.getModel();
      if (!position || !model) return;
      const selection = editorRef.current.getSelection();
      const range =
        selection || new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
      model.applyEdits([{ range, text }]);
      editorRef.current.focus();
    };
    events.on('insertCodeEditorText', insertText);
    return () => {
      events.off('insertCodeEditorText', insertText);
    };
  });

  const lastLocation = useRef<SheetPosTS | undefined>();

  // This is to clear monaco editor's undo/redo stack when the cell location
  // changes useEffect gets triggered when the cell location changes, but the
  // editor content is not loaded in the editor new editor content for the next
  // cell also creates a undo stack entry setTimeout of 250ms is to ensure that
  // the new editor content is loaded, before we clear the undo/redo stack
  useEffect(() => {
    if (
      lastLocation.current &&
      cellLocation.sheetId === lastLocation.current.sheetId &&
      cellLocation.x === lastLocation.current.x &&
      cellLocation.y === lastLocation.current.y
    ) {
      return;
    }
    lastLocation.current = cellLocation;
    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    setTimeout(() => {
      (model as any)._commandManager.clear();
    }, 250);
  }, [cellLocation, editorRef]);

  const runEditorAction = (e: CustomEvent<string>) => editorRef.current?.getAction(e.detail)?.run();
  useEventListener('run-editor-action', runEditorAction);
  const onMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      setIsValidRef(true);

      editor.focus();

      monaco.editor.defineTheme('quadratic', QuadraticEditorTheme);
      monaco.editor.setTheme('quadratic');

      // this needs to be before the register conditional below
      setDidMount(true);

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
          textDocument: { text: editorRef.current?.getValue() ?? '', uri, languageId: 'python' },
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setDidMount]
  );

  useEffect(() => {
    if (editorRef.current && monacoRef.current && didMount) {
      editorRef.current.addCommand(
        monacoRef.current.KeyCode.Escape,
        () => closeEditor(false),
        '!findWidgetVisible && !inReferenceSearchEditor && !editorHasSelection && !suggestWidgetVisible'
      );
      editorRef.current.addCommand(monacoRef.current.KeyCode.KeyL | monacoRef.current.KeyMod.CtrlCmd, () => {
        insertCellRef(editorInteractionState);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeEditor, didMount]);

  useEffect(() => {
    return () => editorRef.current?.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '2rem',
        flex: '2',
      }}
    >
      {modifiedEditorContent === undefined || modifiedEditorContent === editorContent ? (
        <>
          <Editor
            height="100%"
            width="100%"
            language={monacoLanguage}
            value={editorContent}
            onChange={setEditorContent}
            onMount={onMount}
            loading={<CircularProgress style={{ width: '18px', height: '18px' }} />}
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

              // need to ignore unused b/c of the async wrapper around the code and import code
              showUnused: language === 'Javascript' ? false : true,
            }}
          />
          <CodeEditorPlaceholder />
        </>
      ) : (
        <DiffEditor
          height="100%"
          width="100%"
          language={monacoLanguage}
          original={editorContent}
          modified={modifiedEditorContent}
          options={{
            renderSideBySide: false,
            readOnly: true,
            minimap: { enabled: true },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              horizontal: 'hidden',
            },
            wordWrap: 'on',
            showUnused: language === 'Javascript' ? false : true,
          }}
        />
      )}
    </div>
  );
};
