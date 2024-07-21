import { provideCompletionItems, provideHover } from '@/app/quadratic-rust-client/quadratic_rust_client';
import Editor, { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { pyrightWorker, uri } from '../../../web-workers/pythonLanguageServer/worker';
import { useCodeEditor } from './CodeEditorContext';
import { CodeEditorPlaceholder } from './CodeEditorPlaceholder';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from './FormulaLanguageModel';
import {
  provideCompletionItems as provideCompletionItemsPython,
  provideHover as provideHoverPython,
  provideSignatureHelp as provideSignatureHelpPython,
} from './PythonLanguageModel';
import { QuadraticEditorTheme } from './quadraticEditorTheme';
import { useEditorCellHighlights } from './useEditorCellHighlights';
// TODO(ddimaria): leave this as we're looking to add this back in once improved
// import { useEditorDiagnostics } from './useEditorDiagnostics';
// import { Diagnostic } from 'vscode-languageserver-types';
// import { typescriptLibrary } from '@/web-workers/javascriptWebWorker/worker/javascript/typescriptLibrary';
import { events } from '@/app/events/events';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { codeCellIsAConnection, getLanguageForMonaco } from '@/app/helpers/codeCellLanguage';
import { SheetRect } from '@/app/quadratic-core-types';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { javascriptLibraryForEditor } from '@/app/web-workers/javascriptWebWorker/worker/javascript/runner/generatedJavascriptForEditor';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { useFileRouteLoaderData } from '@/routes/file.$uuid';
import useEventListener from '@/shared/hooks/useEventListener';
import { useEditorOnSelectionChange } from './useEditorOnSelectionChange';
import { useEditorReturn } from './useEditorReturn';

interface Props {
  editorContent: string | undefined;
  setEditorContent: (value: string | undefined) => void;
  closeEditor: (skipSaveCheck: boolean) => void;
  evaluationResult?: EvaluationResult;
  cellsAccessed?: SheetRect[] | null;
  cellLocation: SheetPosTS;
  // TODO(ddimaria): leave this as we're looking to add this back in once improved
  // diagnostics?: Diagnostic[];
}

// need to track globally since monaco is a singleton
let registered = false;

export const CodeEditorBody = (props: Props) => {
  const { editorContent, setEditorContent, closeEditor, evaluationResult, cellLocation } = props;
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

  useEditorCellHighlights(isValidRef, editorRef, monacoRef, language);
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
      if (registered) return;

      if (monacoLanguage === 'formula') {
        monaco.languages.register({ id: 'Formula' });
        monaco.languages.setLanguageConfiguration('Formula', FormulaLanguageConfig);
        monaco.languages.setMonarchTokensProvider('Formula', FormulaTokenizerConfig);
        monaco.languages.registerCompletionItemProvider('Formula', {
          provideCompletionItems,
        });
        monaco.languages.registerHoverProvider('Formula', { provideHover });
      }

      if (monacoLanguage === 'python') {
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
      }

      if (monacoLanguage === 'javascript') {
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          diagnosticCodesToIgnore: [1108, 1375, 1378],
        });
        monaco.editor.createModel(javascriptLibraryForEditor, 'javascript');
      }

      registered = true;
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
        minHeight: '100px',
        flex: '2',
      }}
    >
      <Editor
        height="100%"
        width="100%"
        language={monacoLanguage}
        value={editorContent}
        onChange={setEditorContent}
        onMount={onMount}
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
      <CodeEditorPlaceholder editorContent={editorContent} setEditorContent={setEditorContent} />
    </div>
  );
};
