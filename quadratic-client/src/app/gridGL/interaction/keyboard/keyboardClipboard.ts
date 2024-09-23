import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { copySelectionToPNG, fullClipboardSupport } from '@/app/grid/actions/clipboard/clipboard';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { GlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';

export function keyboardClipboard(props: {
  event: React.KeyboardEvent<HTMLElement>;
  addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
}): boolean {
  const { addGlobalSnackbar, event } = props;

  // Copy as PNG
  if (fullClipboardSupport() && matchShortcut(Action.CopyAsPng, event)) {
    copySelectionToPNG(addGlobalSnackbar);
    return true;
  }

  // Download as CSV
  if (matchShortcut(Action.DownloadAsCsv, event)) {
    defaultActionSpec[Action.DownloadAsCsv]?.run();
    return true;
  }

  return false;
}
