import { Coordinate } from '@/app/gridGL/types/size';
import { PanelTab } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { atom, DefaultValue, selector } from 'recoil';

type CodeEditorState = {
  codeString?: string;
  evaluationResult?: EvaluationResult;
  consoleOutput?: { stdOut?: string; stdErr?: string };
  spillError?: Coordinate[];
  panelBottomActiveTab: PanelTab;
  showSnippetsPopover: boolean;
  editorContent?: string;
  modifiedEditorContent?: string;
};

const defaultCodeEditorState: CodeEditorState = {
  codeString: undefined,
  evaluationResult: undefined,
  consoleOutput: undefined,
  spillError: undefined,
  panelBottomActiveTab: 'console',
  showSnippetsPopover: false,
  editorContent: undefined,
  modifiedEditorContent: undefined,
};

export const codeEditorAtom = atom<CodeEditorState>({
  key: 'codeEditorAtom',
  default: defaultCodeEditorState,
});

const createSelector = <T extends keyof CodeEditorState>(key: T) =>
  selector<CodeEditorState[T]>({
    key: `codeEditor${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(codeEditorAtom)[key],
    set: ({ set }, newValue) =>
      set(codeEditorAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      })),
  });

export const codeEditorCodeStringAtom = createSelector('codeString');
export const codeEditorEvaluationResultAtom = createSelector('evaluationResult');
export const codeEditorConsoleOutputAtom = createSelector('consoleOutput');
export const codeEditorSpillErrorAtom = createSelector('spillError');
export const codeEditorPanelBottomActiveTabAtom = createSelector('panelBottomActiveTab');
export const codeEditorShowSnippetsPopoverAtom = createSelector('showSnippetsPopover');
export const codeEditorEditorContentAtom = createSelector('editorContent');
export const codeEditorModifiedEditorContentAtom = createSelector('modifiedEditorContent');
