import type { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';

export function keyboardSearch(
  event: KeyboardEvent,
  editorInteractionState: EditorInteractionState,
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>
): boolean {
  // Command/Ctrl + F
  if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
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
