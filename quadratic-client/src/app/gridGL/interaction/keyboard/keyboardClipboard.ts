import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { copySelectionToPNG, fullClipboardSupport } from '@/app/grid/actions/clipboard/clipboard';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';

export function keyboardClipboard(event: React.KeyboardEvent<HTMLElement>): boolean {
  // Copy as PNG
  if (fullClipboardSupport() && matchShortcut(Action.CopyAsPng, event)) {
    copySelectionToPNG();
    return true;
  }

  // Download as CSV
  if (matchShortcut(Action.DownloadAsCsv, event)) {
    defaultActionSpec[Action.DownloadAsCsv]?.run();
    return true;
  }

  return false;
}
