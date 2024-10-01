import { cellTypeMenuOpenedCountAtom } from '@/app/atoms/cellTypeMenuOpenedCountAtom';
import { codeEditorShowSnippetsPopoverAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetBounds } from '@/app/quadratic-core-types';
import { atom, DefaultValue, selector } from 'recoil';

interface CodeHintState {
  sheetEmpty: boolean;
  multipleSelection: boolean;
}

const defaultCodeHintState: CodeHintState = {
  sheetEmpty: sheets.sheet.bounds.type === 'empty',
  multipleSelection: false,
};

export const codeHintAtom = atom({
  key: 'codeHintState',
  default: defaultCodeHintState,
  effects: [
    ({ setSelf }) => {
      const updateMultipleSelection = () => {
        const multipleSelection =
          sheets.sheet.cursor.multiCursor !== undefined || sheets.sheet.cursor.columnRow !== undefined;
        setSelf((prev) => {
          if (prev instanceof DefaultValue) return prev;
          return { ...prev, multipleSelection, sheetEmpty: sheets.sheet.bounds.type === 'empty' };
        });
      };

      const handleChangeSheet = () => {
        setSelf((prev) => {
          if (prev instanceof DefaultValue) return prev;
          return { ...prev, sheetEmpty: sheets.sheet.bounds.type === 'empty' };
        });
      };

      const updateSheetEmpty = (sheetBounds: SheetBounds) => {
        setSelf((prev) => {
          if (prev instanceof DefaultValue) return prev;
          return { ...prev, sheetEmpty: sheetBounds.bounds.type === 'empty' };
        });
      };

      events.on('cursorPosition', updateMultipleSelection);
      events.on('changeSheet', handleChangeSheet);
      events.on('sheetBounds', updateSheetEmpty);
      return () => {
        events.off('cursorPosition', updateMultipleSelection);
        events.off('changeSheet', handleChangeSheet);
        events.off('sheetBounds', updateSheetEmpty);
      };
    },
  ],
});

export const showCodeHintState = selector({
  key: 'showCodeHint',
  get: ({ get }) => {
    const cellTypeMenuOpenedCount = get(cellTypeMenuOpenedCountAtom);
    const { sheetEmpty, multipleSelection } = get(codeHintAtom);
    const showCodeEditor = get(codeEditorShowSnippetsPopoverAtom);
    const permissions = get(editorInteractionStatePermissionsAtom);
    return (
      cellTypeMenuOpenedCount < 4 &&
      sheetEmpty &&
      !multipleSelection &&
      !showCodeEditor &&
      permissions.includes('FILE_EDIT')
    );
  },
});
