import { grid } from '@/grid/controller/Grid';
import { hasPermissionToEditFile } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';

export function keyboardCode(
  event: React.KeyboardEvent<HTMLElement>,
  editorInteractionState: EditorInteractionState
): boolean {
  if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
    return false;
  }
  if (event.code === 'Enter' && (event.ctrlKey || event.metaKey)) {
    if (event.shiftKey) {
      if (event.altKey) {
        grid.rerunSheetCodeCells();
      } else {
        grid.rerunAllCodeCells();
      }
    } else {
      grid.rerunCodeCell();
    }
    event.preventDefault();
    return true;
  }
  return false;
}
