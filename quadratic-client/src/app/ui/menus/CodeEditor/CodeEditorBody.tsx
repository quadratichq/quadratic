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
import { events } from '@/app/events/events';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { codeCellIsAConnection, getLanguageForMonaco } from '@/app/helpers/codeCellLanguage';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { provideCompletionItems, provideHover } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { CodeEditorPlaceholder } from '@/app/ui/menus/CodeEditor/CodeEditorPlaceholder';
import { FormulaLanguageConfig, FormulaTokenizerConfig } from '@/app/ui/menus/CodeEditor/FormulaLanguageModel';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
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
import Editor, { DiffEditor, Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

interface CodeEditorBodyProps {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
  setEditorInst: React.Dispatch<React.SetStateAction<monaco.editor.IStandaloneCodeEditor | null>>;
}

// need to track globally since monaco is a singleton
const registered: Record<Exclude<Extract<CodeCellLanguage, string>, 'AIResearcher'>, boolean> = {
  Formula: false,
  Python: false,
  Javascript: false,
};

export const CodeEditorBody = (props: CodeEditorBodyProps) => {
  const { editorInst, setEditorInst } = props;
  const showCodeEditor = useRecoilValue(codeEditorShowCodeEditorAtom);
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);
  const monacoLanguage = useMemo(() => getLanguageForMonaco(codeCell.language), [codeCell.language]);
  const isConnection = useMemo(() => codeCellIsAConnection(codeCell.language), [codeCell.language]);
  const [editorContent, setEditorContent] = useRecoilState(codeEditorEditorContentAtom);
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

  const lastLocation = useRef<CodeCell | undefined>();
  // This is to clear monaco editor's undo/redo stack when the cell location
  // changes useEffect gets triggered when the cell location changes, but the
  // editor content is not loaded in the editor new editor content for the next
  // cell also creates a undo stack entry setTimeout of 250ms is to ensure that
  // the new editor content is loaded, before we clear the undo/redo stack
  useEffect(() => {
    if (
      lastLocation.current &&
      codeCell.sheetId === lastLocation.current.sheetId &&
      codeCell.pos.x === lastLocation.current.pos.x &&
      codeCell.pos.x === lastLocation.current.pos.y
    ) {
      return;
    }
    lastLocation.current = codeCell;
    if (!editorInst) return;

    const model = editorInst.getModel();
    if (!model) return;

    setTimeout(() => {
      (model as any)._commandManager.clear();
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorInst, codeCell.sheetId, codeCell.pos.x, codeCell.pos.y]);

  const addCommands = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editor.addCommand(
        monaco.KeyCode.Escape,
        () => closeEditor(false),
        '!findWidgetVisible && !inReferenceSearchEditor && !editorHasSelection && !suggestWidgetVisible'
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
    },
    [addCommands, monacoLanguage, setEditorInst]
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

  if (!showDiffEditor && (editorContent === undefined || loading)) {
    return (
      <div className="flex justify-center">
        <SpinnerIcon className="text-primary" />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '2rem',
        flex: '2',
      }}
      className="dark-mode-hack"
    >
      {!showDiffEditor ? (
        <>
          <Editor
            height="100%"
            width="100%"
            language={monacoLanguage}
            value={editorContent}
            onChange={setEditorContent}
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

              // need to ignore unused b/c of the async wrapper around the code and import code
              showUnused: codeCell.language === 'Javascript' ? false : true,
            }}
          />
          <CodeEditorPlaceholder />
        </>
      ) : (
        <DiffEditor
          height="100%"
          width="100%"
          language={monacoLanguage}
          original={diffEditorContent?.isApplied ? diffEditorContent.editorContent : editorContent}
          modified={diffEditorContent?.isApplied ? editorContent : diffEditorContent?.editorContent}
          onMount={onMountDiff}
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
            showUnused: codeCell.language === 'Javascript' ? false : true,
          }}
        />
      )}
    </div>
  );
};
