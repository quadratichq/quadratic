import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { events } from '@/app/events/events';
import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  pasteFromClipboard,
} from '@/app/grid/actions/clipboard/clipboard';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { downloadFile } from '@/app/helpers/downloadFileInBrowser';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  CopyAsPng,
  CopyIcon,
  CsvIcon,
  CutIcon,
  FindInFileIcon,
  PasteIcon,
  RedoIcon,
  UndoIcon,
} from '@/shared/components/Icons';

type EditActionSpec = Pick<
  ActionSpecRecord,
  | Action.Undo
  | Action.Redo
  | Action.Cut
  | Action.Copy
  | Action.Paste
  | Action.PasteValuesOnly
  | Action.PasteFormattingOnly
  | Action.FindInCurrentSheet
  | Action.FindInAllSheets
  | Action.CopyAsPng
  | Action.DownloadAsCsv
  | Action.Save
  | Action.FillRight
  | Action.FillDown
  | Action.EditCell
  | Action.ToggleArrowMode
  | Action.DeleteCell
  | Action.CloseInlineEditor
  | Action.SaveInlineEditor
  | Action.SaveInlineEditorMoveUp
  | Action.SaveInlineEditorMoveRight
  | Action.SaveInlineEditorMoveLeft
  | Action.TriggerCell
>;

export const editActionsSpec: EditActionSpec = {
  [Action.Undo]: {
    label: () => 'Undo',
    Icon: UndoIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      quadraticCore.undo();
    },
  },
  [Action.Redo]: {
    label: () => 'Redo',
    Icon: RedoIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      quadraticCore.redo();
    },
  },
  [Action.Cut]: {
    label: () => 'Cut',
    Icon: CutIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      cutToClipboard();
    },
  },
  [Action.Copy]: {
    label: () => 'Copy',
    Icon: CopyIcon,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      copyToClipboard();
    },
  },
  [Action.Paste]: {
    label: () => 'Paste',
    Icon: PasteIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      pasteFromClipboard();
    },
  },
  [Action.PasteValuesOnly]: {
    label: () => 'Paste values only',
    Icon: PasteIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      pasteFromClipboard('Values');
    },
  },
  [Action.PasteFormattingOnly]: {
    label: () => 'Paste formatting only',
    Icon: PasteIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      pasteFromClipboard('Formats');
    },
  },
  [Action.FindInCurrentSheet]: {
    label: () => 'Find in current sheet',
    Icon: FindInFileIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showSearch: true }));
    },
    keywords: ['search'],
  },
  [Action.FindInAllSheets]: {
    label: () => 'Find in all sheets',
    Icon: FindInFileIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showSearch: {
          whole_cell: null,
          search_code: null,
          sheet_id: null,
          case_sensitive: null,
        },
      }));
    },
    keywords: ['search'],
  },
  [Action.CopyAsPng]: {
    label: () => 'Copy as PNG',
    labelVerbose: 'Copy selection as PNG',
    Icon: CopyAsPng,
    run: () => {
      pixiAppSettings.setContextMenu?.({});
      if (!pixiAppSettings.addGlobalSnackbar) return;
      copySelectionToPNG(pixiAppSettings.addGlobalSnackbar);
    },
  },
  [Action.DownloadAsCsv]: {
    label: () => 'Download as CSV',
    labelVerbose: 'Download selection as CSV',
    Icon: CsvIcon,
    run: async () => {
      pixiAppSettings.setContextMenu?.({});
      // use table name if available, otherwise use timestamp
      let fileName = sheets.sheet.cursor.getSingleTableSelection();

      if (!fileName) {
        // Convert ISO timestamp to a string without colons or dots
        // (since those aren't valid in filenames on some OSes)
        const timestamp = new Date().toISOString().replace(/:|\./g, '-');
        fileName = `quadratic-csv-export-${timestamp}`;
      }

      downloadFile(fileName, await quadraticCore.exportCsvSelection(sheets.getRustSelection()), 'text/plain', 'csv');
    },
  },
  [Action.Save]: {
    label: () => 'Save',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.FillRight]: {
    label: () => 'Fill right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.FillDown]: {
    label: () => 'Fill down',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.EditCell]: {
    label: () => 'Edit cell',
    run: () => {
      if (!inlineEditorHandler.isEditingFormula()) {
        const { x, y } = sheets.sheet.cursor.position;
        const table = pixiApp.cellsSheet().tables.getTableFromTableCell(x, y);
        if (table) {
          doubleClickCell({
            column: x,
            row: y,
            cell: '',
          });
        } else {
          quadraticCore.getEditCell(sheets.current, x, y).then((cell) => {
            doubleClickCell({
              column: x,
              row: y,
              cell,
              cursorMode: cell ? CursorMode.Edit : CursorMode.Enter,
            });
          });
        }

        return true;
      }
    },
  },
  [Action.ToggleArrowMode]: {
    label: () => 'Toggle arrow mode',
    run: () => {
      if (!inlineEditorHandler.isEditingFormula()) {
        const { x, y } = sheets.sheet.cursor.position;
        const table = pixiApp.cellsSheet().tables.getTableFromTableCell(x, y);
        if (table) {
          doubleClickCell({
            column: x,
            row: y,
            cell: '',
            cursorMode: CursorMode.Edit,
          });
        } else {
          quadraticCore.getEditCell(sheets.current, x, y).then((cell) => {
            doubleClickCell({ column: x, row: y, cell, cursorMode: CursorMode.Edit });
          });
        }
        return true;
      }
    },
  },
  [Action.DeleteCell]: {
    label: () => 'Delete cell',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.CloseInlineEditor]: {
    label: () => 'Close inline editor',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.SaveInlineEditor]: {
    label: () => 'Save inline editor',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.SaveInlineEditorMoveUp]: {
    label: () => 'Save inline editor and move up',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.SaveInlineEditorMoveRight]: {
    label: () => 'Save inline editor and move right',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.SaveInlineEditorMoveLeft]: {
    label: () => 'Save inline editor and move left',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.TriggerCell]: {
    label: () => 'Trigger cell',
    run: () => {
      const p = sheets.sheet.cursor.position;
      events.emit('triggerCell', p.x, p.y, true);
    },
  },
};
