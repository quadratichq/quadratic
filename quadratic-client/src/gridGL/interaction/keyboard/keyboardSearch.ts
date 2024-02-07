import { EditorInteractionState } from '@/atoms/editorInteractionStateAtom';
import { sheets } from '@/grid/controller/Sheets';

export function keyboardSearch(
  event: KeyboardEvent,
  editorInteractionState: EditorInteractionState,
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>
): boolean {
  // Command/Ctrl + F
  if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
    if (editorInteractionState.showSearch) {
      const search = document.getElementById('search-input');
      search?.focus();
    } else {
      setEditorInteractionState((prev) => ({
        ...prev,
        showSearch: true,
        searchOptions: { case_sensitive: false, whole_cell: false, search_code: false, sheet_id: sheets.sheet.id },
      }));
    }
    event.preventDefault();
    return true;
  }
  return false;
}
