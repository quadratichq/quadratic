import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import type { Monaco } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';
import type { Diagnostic } from 'vscode-languageserver-types';

export const useEditorDiagnostics = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<Monaco | null>,
  language?: CodeCellLanguage,
  diagnostics?: Diagnostic[]
) => {
  const currentDiagnostics = useRef<monaco.editor.IEditorDecorationsCollection | undefined>(undefined);

  useEffect(() => {
    if (language === 'Formula') return;

    const editor = editorRef.current;
    const monacoInst = monacoRef.current;

    if (!isValidRef || !editor || !monacoInst) return;

    const model = editor.getModel();

    if (!model) return;

    const onChangeModel = () => {
      if (!diagnostics?.length) return;

      if (currentDiagnostics) currentDiagnostics.current?.clear();

      const markers = diagnostics.map(({ message, range, severity }) => ({
        message,
        severity: (severity as monaco.MarkerSeverity) || monacoInst.MarkerSeverity.Error,
        startLineNumber: range.start.line + 1,
        startColumn: range.start.character + 1,
        endLineNumber: range.end.line + 1,
        endColumn: range.end.character + 1,
      }));
      monacoInst.editor.setModelMarkers(model, 'owner', markers);
    };

    onChangeModel();

    editor.onDidChangeModelContent(() => currentDiagnostics.current?.clear());
  }, [isValidRef, editorRef, monacoRef, language, diagnostics]);
};
