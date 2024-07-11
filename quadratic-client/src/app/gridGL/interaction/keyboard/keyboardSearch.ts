import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardSearch(
  event: KeyboardEvent,
  editorInteractionState: EditorInteractionState,
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>
): boolean {
  // Show search
  if (matchShortcut('show_search', event)) {
    event.preventDefault();
    if (editorInteractionState.showSearch) {
      const search = document.getElementById('search-input');
      search?.focus();
    } else {
      setEditorInteractionState((prev) => ({
        ...prev,
        showSearch: event.shiftKey ? { sheet_id: undefined } : true,
      }));
    }
    return true;
  }
  return false;
}
