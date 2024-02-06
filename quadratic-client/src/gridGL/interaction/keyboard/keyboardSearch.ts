import { EditorInteractionState } from '@/atoms/editorInteractionStateAtom';
import { sheets } from '@/grid/controller/Sheets';

export function keyboardSearch(
  event: React.KeyboardEvent<HTMLElement>,
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>
): boolean {
  // Command/Ctrl + F
  if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
    setEditorInteractionState((prev) => ({
      ...prev,
      showSearch: true,
      searchOptions: { case_sensitive: false, whole_cell: false, search_code: false, sheet_id: sheets.sheet.id },
    }));
    event.preventDefault();
    return true;
  }
  return false;
}
