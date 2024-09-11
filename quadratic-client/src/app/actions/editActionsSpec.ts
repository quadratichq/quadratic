import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  pasteFromClipboard,
} from '@/app/grid/actions/clipboard/clipboard';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { downloadFile } from '@/app/helpers/downloadFileInBrowser';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  CopyAsPng,
  CopyIcon,
  CsvIcon,
  CutIcon,
  FindInFileIcon,
  GoToIcon,
  PasteIcon,
  RedoIcon,
  UndoIcon,
} from '@/shared/components/Icons';

export const editActionsSpec = {
  [Action.Undo]: {
    label: 'Undo',
    Icon: UndoIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      quadraticCore.undo();
    },
  },
  [Action.Redo]: {
    label: 'Redo',
    Icon: RedoIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      quadraticCore.redo();
    },
  },
  [Action.Cut]: {
    label: 'Cut',
    Icon: CutIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      cutToClipboard();
    },
  },
  [Action.Copy]: {
    label: 'Copy',
    Icon: CopyIcon,
    run: () => {
      copyToClipboard();
    },
  },
  [Action.Paste]: {
    label: 'Paste',
    Icon: PasteIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pasteFromClipboard();
    },
  },
  [Action.PasteValuesOnly]: {
    label: 'Paste values only',
    Icon: PasteIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pasteFromClipboard('Values');
    },
  },
  [Action.PasteFormattingOnly]: {
    label: 'Paste formatting only',
    Icon: PasteIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pasteFromClipboard('Formats');
    },
  },
  [Action.ShowGoToMenu]: {
    label: 'Go to',
    Icon: GoToIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showGoToMenu: true }));
    },
  },
  [Action.FindInCurrentSheet]: {
    label: 'Find in current sheet',
    Icon: FindInFileIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showSearch: true }));
    },
  },
  [Action.FindInAllSheets]: {
    label: 'Find in all sheets',
    Icon: FindInFileIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showSearch: { sheet_id: undefined } }));
    },
  },
  [Action.CopyAsPng]: {
    label: 'Copy as PNG',
    Icon: CopyAsPng,
    run: () => {
      if (!pixiAppSettings.addGlobalSnackbar) return;
      copySelectionToPNG(pixiAppSettings.addGlobalSnackbar);
    },
  },
  [Action.DownloadAsCsv]: {
    label: 'Download as CSV',
    Icon: CsvIcon,
    run: async () => {
      // Convert ISO timestamp to a string without colons or dots
      // (since those aren't valid in filenames on some OSes)
      const timestamp = new Date().toISOString().replace(/:|\./g, '-');
      const fileName = `quadratic-csv-export-${timestamp}`;
      downloadFile(fileName, await quadraticCore.exportCsvSelection(sheets.getRustSelection()), 'text/plain', 'csv');
    },
  },
};
