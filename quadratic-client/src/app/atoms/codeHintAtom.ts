import { codeEditorShowSnippetsPopoverAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { fileHasData } from '@/app/gridGL/helpers/fileHasData';
import type { SheetBounds } from '@/app/quadratic-core-types';
import { isMobile } from 'react-device-detect';
import { atom, DefaultValue, selector } from 'recoil';

interface CodeHintState {
  sheetEmpty: boolean;
}

const defaultCodeHintState: CodeHintState = {
  sheetEmpty: sheets.initialized ? fileHasData() : false,
};

export const codeHintAtom = atom({
  key: 'codeHintState',
  default: defaultCodeHintState,
  effects: [
    ({ setSelf }) => {
      const handleChangeSheet = () => {
        setSelf((prev) => {
          if (prev instanceof DefaultValue) return prev;
          return { ...prev, sheetEmpty: fileHasData() };
        });
      };

      const updateSheetEmpty = (sheetBounds: SheetBounds) => {
        setSelf((prev) => {
          if (prev instanceof DefaultValue) return prev;
          return { ...prev, sheetEmpty: fileHasData() };
        });
      };

      events.on('changeSheet', handleChangeSheet);
      events.on('sheetBounds', updateSheetEmpty);
      return () => {
        events.off('changeSheet', handleChangeSheet);
        events.off('sheetBounds', updateSheetEmpty);
      };
    },
  ],
});

export const showCodeHintState = selector({
  key: 'showCodeHint',
  get: ({ get }) => {
    // const cellTypeMenuOpenedCount = get(cellTypeMenuOpenedCountAtom);
    const { sheetEmpty } = get(codeHintAtom);
    const showCodeEditor = get(codeEditorShowSnippetsPopoverAtom);
    const permissions = get(editorInteractionStatePermissionsAtom);
    return (
      // cellTypeMenuOpenedCount < 4 &&
      sheetEmpty && !showCodeEditor && permissions.includes('FILE_EDIT') && !isMobile
    );
  },
});
