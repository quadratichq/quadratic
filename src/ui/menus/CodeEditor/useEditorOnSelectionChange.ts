import monaco from 'monaco-editor';
import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { editorHighlightedCellsStateAtom } from '../../../atoms/editorHighlightedCellsStateAtom';

export const useEditorOnSelectionChange = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
) => {
  const setHighlightedCells = useSetRecoilState(editorHighlightedCellsStateAtom);

  useEffect(() => {
    const editor = editorRef.current;
    if (!isValidRef || !editor) return;
    editor.onDidChangeCursorPosition((e) => {
      setHighlightedCells((oldState) => {
        let selectedCell: string = '';
        for (const [highlightedCell, range] of oldState.highlightedCells.entries()) {
          if (!range.containsPosition(e.position)) continue;
          selectedCell = highlightedCell;
          break;
        }
        return {
          ...oldState,
          selectedCell,
        };
      });
    });

    return () => editor.dispose();
  }, [isValidRef, setHighlightedCells, editorRef]);
};
