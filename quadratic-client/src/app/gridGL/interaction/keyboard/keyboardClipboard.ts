import { downloadSelectionAsCsvAction } from '@/app/actions';
import { copySelectionToPNG, fullClipboardSupport } from '@/app/grid/actions/clipboard/clipboard';
import { GlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';

export function keyboardClipboard(props: {
  event: React.KeyboardEvent<HTMLElement>;
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
  fileName: string;
}): boolean {
  const { addGlobalSnackbar, event, fileName } = props;

  // Command + Shift + C
  if (fullClipboardSupport() && (event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'c') {
    event.preventDefault();
    event.stopPropagation();
    copySelectionToPNG(addGlobalSnackbar);
    return true;
  }

  // Command + Shift + E
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'e') {
    event.preventDefault();
    event.stopPropagation();
    downloadSelectionAsCsvAction.run({ fileName });
    return true;
  }

  return false;
}
