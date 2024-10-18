import { ArrowMode, inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { LINE_HEIGHT } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { atom } from 'recoil';

export interface InlineEditorState {
  visible: boolean;
  formula: boolean;
  left: number;
  top: number;
  height: number;
  navigateText: boolean;
}

export const defaultInlineEditor: InlineEditorState = {
  visible: false,
  formula: false,
  left: 0,
  top: 0,
  height: LINE_HEIGHT,
  navigateText: false,
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
        inlineEditorKeyboard.arrowMode = newValue.navigateText ? ArrowMode.NavigateText : ArrowMode.SelectCell;
        pixiApp.cursor.dirty = true;
      });
    },
  ],
});
