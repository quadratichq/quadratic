import { GlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import { PNG_MESSAGE } from '../../../constants/appConstants';
import { copySelectionToPNG } from '../../../grid/actions/clipboard/clipboard';

export function keyboardClipboard(props: {
  event: React.KeyboardEvent<HTMLElement>;
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
}): boolean {
  const { addGlobalSnackbar, event } = props;

  // Command + Shift + C
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'c') {
    copySelectionToPNG();
    addGlobalSnackbar(PNG_MESSAGE);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return false;
}
