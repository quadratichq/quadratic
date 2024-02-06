import { EditorInteractionState } from '@/atoms/editorInteractionStateAtom';

export function keyboardSearch(
  event: React.KeyboardEvent<HTMLElement>,
  setEditorInteractionState: React.Dispatch<React.SetStateAction<EditorInteractionState>>
): boolean {
  // Command/Ctrl + F
  if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
    setEditorInteractionState((prev) => ({ ...prev, showSearch: true }));
    event.preventDefault();
    return true;
  }
  return false;
}
