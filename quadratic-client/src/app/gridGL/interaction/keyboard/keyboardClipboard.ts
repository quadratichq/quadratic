import { downloadSelectionAsCsvAction } from '@/app/actions';
import { Action } from '@/app/actions/actions';
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
  if (fullClipboardSupport() && matchShortcut(Action.CopyAsPng, event)) {
    copySelectionToPNG(addGlobalSnackbar);
    return true;
  }

  // Download as CSV
  if (matchShortcut(Action.DownloadAsCsv, event)) {
    downloadSelectionAsCsvAction.run({ fileName });
    return true;
  }

  return false;
}
