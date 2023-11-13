import { selectAllCells } from '../../helpers/selectCells';

export function keyboardSelect(event: React.KeyboardEvent<HTMLElement>): boolean {
  // Command + A
  if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
    selectAllCells();
    event.preventDefault();
    return true;
  }
  return false;
}
