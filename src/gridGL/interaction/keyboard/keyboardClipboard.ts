import { downloadSelectionAsCsvAction } from '@/actions';
import { GlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import { copySelectionToPNG, fullClipboardSupport } from '../../../grid/actions/clipboard/clipboard';

export function keyboardClipboard(props: {
  event: React.KeyboardEvent<HTMLElement>;
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
  fileName: string;
}): boolean {
  const { addGlobalSnackbar, event, fileName } = props;

  // Command + Shift + C
  if (fullClipboardSupport() && (event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'c') {
    copySelectionToPNG(addGlobalSnackbar);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  // Command + Shift + E
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'e') {
    downloadSelectionAsCsvAction.run({ fileName });
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return false;
}
