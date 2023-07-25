import { atom } from 'recoil';
import { CellMatch } from '../hooks/useEditorCellHighlights';

export interface EditorHighlightedCellsState {
  highlightedCells: CellMatch;
  selectedCell: string;
}

export const editorHighlightedCellsStateDefault: EditorHighlightedCellsState = {
  highlightedCells: new Map(),
  selectedCell: '',
};

export const editorHighlightedCellsStateAtom = atom({
  key: 'editorHighlightedCellsState',
  default: editorHighlightedCellsStateDefault,
});
