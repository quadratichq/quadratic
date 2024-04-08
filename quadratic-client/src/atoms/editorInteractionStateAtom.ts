import { Coordinate } from '@/gridGL/types/size';
import { CodeCellLanguage, SearchOptions } from '@/quadratic-core/types';
import { FilePermission } from 'quadratic-shared/typesAndSchemas';
import { atom } from 'recoil';

const params = new URLSearchParams(window.location.search);
const codeX = params.has('codeX') ? Number(params.get('codeX')) : 0;
const codeY = params.has('codeY') ? Number(params.get('codeY')) : 0;
const sheet = params.get('sheet') ?? '';

export interface EditorInteractionState {
  showCellTypeMenu: boolean;
  showCodeEditor: boolean;
  showCommandPalette: boolean;
  showGoToMenu: boolean;
  showFeedbackMenu: boolean;
  showShareFileMenu: boolean;
  showSearch: boolean | SearchOptions;
  permissions: FilePermission[];
  uuid: string;
  selectedCell: Coordinate;
  selectedCellSheet: string;
  selectedCellSheetName?: string;
  mode?: CodeCellLanguage;
  follow?: string;
  editorEscapePressed?: boolean;
  waitingForEditorClose?: {
    selectedCell: Coordinate;
    selectedCellSheet: string;
    mode?: CodeCellLanguage;
    showCellTypeMenu: boolean;
  };
}

export const editorInteractionStateDefault: EditorInteractionState = {
  showCellTypeMenu: false,
  showCodeEditor: params.has('codeX'),
  showCommandPalette: false,
  showGoToMenu: false,
  showFeedbackMenu: false,
  showShareFileMenu: false,
  showSearch: false,
  permissions: ['FILE_VIEW'], // FYI: when we call <RecoilRoot> we initialize this with the value from the server
  uuid: '', // when we call <RecoilRoot> we initialize this with the value from the server
  selectedCell: { x: codeX, y: codeY },
  selectedCellSheet: '',
  selectedCellSheetName: sheet,
  mode: undefined,
};

export const editorInteractionStateAtom = atom({
  key: 'editorInteractionState', // unique ID (with respect to other atoms/selectors)
  default: editorInteractionStateDefault,
});
