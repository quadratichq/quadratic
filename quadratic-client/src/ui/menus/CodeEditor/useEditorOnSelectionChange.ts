import { CodeCellLanguage } from '@/quadratic-core/types';
import monaco from 'monaco-editor';
import { useEffect } from 'react';
import { pixiApp } from '../../../gridGL/pixiApp/PixiApp';

export const useEditorOnSelectionChange = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<typeof monaco | null>,
  language?: CodeCellLanguage
) => {
  useEffect(() => {
    if (language !== 'Formula') return;

    const editor = editorRef.current;

    if (!isValidRef || !editor) return;

    const model = editor.getModel();
    const monacoInst = monacoRef.current;

    if (!monacoInst || !model) return;

    editor.onDidChangeCursorPosition((e) => {
      pixiApp.highlightedCells.getHighlightedCells().find((value) => {
        const span = value.span;
        const startPosition = model.getPositionAt(span.start);
        const endPosition = model.getPositionAt(span.end);
        const range = new monacoInst.Range(
          startPosition.lineNumber,
          startPosition.column,
          endPosition.lineNumber,
          endPosition.column
        );

        if (range.containsPosition(e.position)) {
          pixiApp.highlightedCells.setHighlightedCell(value.index);
          return true;
        }

        pixiApp.highlightedCells.setHighlightedCell(-1);

        return false;
      });
    });
  }, [isValidRef, editorRef, monacoRef, language]);
};
