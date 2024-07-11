import { downloadSelectionAsCsvAction } from '@/app/actions';
import { copySelectionToPNG, fullClipboardSupport } from '@/app/grid/actions/clipboard/clipboard';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { GlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';

export function keyboardClipboard(props: {
  event: React.KeyboardEvent<HTMLElement>;
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
  fileName: string;
}): boolean {
  const { addGlobalSnackbar, event, fileName } = props;

  // Copy as PNG
  if (fullClipboardSupport() && matchShortcut('copy_as_png', event)) {
    copySelectionToPNG(addGlobalSnackbar);
    return true;
  }

  // Download as CSV
  if (matchShortcut('download_as_csv', event)) {
    downloadSelectionAsCsvAction.run({ fileName });
    return true;
  }

  return false;
}
