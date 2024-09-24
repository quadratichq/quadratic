import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { copySelectionToPNG, fullClipboardSupport } from '@/app/grid/actions/clipboard/clipboard';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardClipboard(event: React.KeyboardEvent<HTMLElement>): boolean {
  const { addGlobalSnackbar } = pixiAppSettings;
  if (!addGlobalSnackbar) {
    throw new Error('Expected addGlobalSnackbar to be defined in keyboardClipboard');
  }

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
