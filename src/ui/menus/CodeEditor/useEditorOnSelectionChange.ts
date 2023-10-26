import monaco from 'monaco-editor';
import { useEffect } from 'react';
import { pixiApp } from '../../../gridGL/pixiApp/PixiApp';

export const useEditorOnSelectionChange = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<typeof monaco | null>
) => {
  useEffect(() => {
    const editor = editorRef.current;
    if (!isValidRef || !editor) return;
    const model = editor.getModel();
    const monacoInst = monacoRef.current;
    if (!monacoInst || !model) return;

    editor.onDidChangeCursorPosition((e) => {
      pixiApp.highlightedCells.getHighlightedCells().find((value, index) => {
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
          pixiApp.highlightedCells.setHighlightedCell(index);
          return true;
        }
        return false;
      });
    });
    return () => editor.dispose();
  }, [isValidRef, editorRef, monacoRef]);
};
