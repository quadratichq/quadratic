import { Action } from '@/app/actions/actions';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardSearch(event: React.KeyboardEvent<HTMLElement>): boolean {
  const { editorInteractionState, setEditorInteractionState } = pixiAppSettings;
  if (!setEditorInteractionState) {
    throw new Error('Expected setEditorInteractionState to be defined in keyboardSearch');
  }

  // Show search
  if (matchShortcut(Action.FindInCurrentSheet, event) || matchShortcut(Action.FindInAllSheets, event)) {
    event.preventDefault();
    if (editorInteractionState.showSearch) {
      const search = document.getElementById('search-input') as HTMLInputElement;
      if (search) {
        search.focus();
        search.select();
      }
    } else {
      setEditorInteractionState((prev) => ({
        ...prev,
        showSearch: event.shiftKey
          ? { sheet_id: null, whole_cell: null, search_code: null, case_sensitive: null, regex: null }
          : true,
      }));
    }
    return true;
  }
  return false;
}
