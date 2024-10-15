import { ArrowMode, inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { atom } from 'recoil';

export interface InlineEditorState {
  visible: boolean;
  formula: boolean;
  left: number;
  top: number;
  lineHeight: number;
  insertCellRef: boolean;
}

export const defaultInlineEditor: InlineEditorState = {
  visible: false,
  formula: false,
  left: 0,
  top: 0,
  lineHeight: 19,
  insertCellRef: true,
};

export const inlineEditorAtom = atom({
  key: 'inlineEditorState',
  default: defaultInlineEditor,
  effects: [
    ({ onSet }) => {
      onSet((newValue) => {
        if (newValue.visible) {
          inlineEditorMonaco.focus();
        }
        inlineEditorKeyboard.arrowMode = newValue.insertCellRef ? ArrowMode.InsertCellRef : ArrowMode.NavigateText;
      });
    },
  ],
});
