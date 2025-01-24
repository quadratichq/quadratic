import { hasPermissionToEditFile } from '@/app/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import type { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export async function doubleClickCell(options: {
  column: number;
  row: number;
  cell?: string;
  cursorMode?: CursorMode;
}) {
  const { column, row, cell, cursorMode } = options;

  if (inlineEditorHandler.isEditingFormula()) {
    return;
  }

  if (multiplayer.cellIsBeingEdited(column, row, sheets.sheet.id)) {
    return;
  }

  if (!pixiAppSettings.setEditorInteractionState || !pixiAppSettings.setCodeEditorState) {
    return;
  }

  const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);
  const table = pixiApp.cellsSheet().tables.getTableFromTableCell(column, row);
  const codeCell = table?.codeCell;
  const language = codeCell?.language;

  // Open the correct code editor
  if (language) {
    const formula = language === 'Formula';
    const file_import = language === 'Import';

    if (pixiAppSettings.codeEditorState.showCodeEditor && !file_import) {
      pixiAppSettings.setCodeEditorState({
        ...pixiAppSettings.codeEditorState,
        escapePressed: false,
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: codeCell.x, y: codeCell.y },
            language,
          },
          showCellTypeMenu: false,
          initialCode: '',
          inlineEditor: formula,
        },
      });
    } else {
      if (hasPermission && formula) {
        const cursor = sheets.sheet.cursor.position;

        // ensure we're in the right cell (which may change if we double clicked on a CodeRun)
        if (cursor.x !== column || cursor.y !== row) {
          sheets.sheet.cursor.moveTo(column, row);
        }
        pixiAppSettings.changeInput(true, cell, cursorMode);
      }
      // editing inside data table
      else if (hasPermission && file_import) {
        // can't create formula inside data table
        if (cell?.startsWith('=')) {
          pixiAppSettings.snackbar('Cannot create formula inside data table', { severity: 'warning' });
        }

        // check column header or table value
        else {
          const isColumnHeader =
            codeCell.show_ui && codeCell.show_columns && row === codeCell.y + (codeCell.show_name ? 1 : 0);
          if (isColumnHeader) {
            const contextMenu = {
              type: ContextMenuType.TableColumn,
              rename: true,
              table: codeCell,
              selectedColumn: Math.max(0, column - codeCell.x),
              initialValue: cell,
            };
            events.emit('contextMenu', contextMenu);
          } else {
            pixiAppSettings.changeInput(true, cell, cursorMode);
          }
        }
      } else {
        pixiAppSettings.setCodeEditorState({
          ...pixiAppSettings.codeEditorState,
          showCodeEditor: true,
          escapePressed: false,
          diffEditorContent: undefined,
          waitingForEditorClose: {
            codeCell: {
              sheetId: sheets.current,
              pos: { x: codeCell.x, y: codeCell.y },
              language,
            },
            initialCode: '',
            showCellTypeMenu: false,
          },
        });
      }
    }
  }

  // Open the text editor
  else if (hasPermission) {
    const value = await quadraticCore.getCellValue(sheets.sheet.id, column, row);

    // open the calendar pick if the cell is a date
    if (value && ['date', 'date time'].includes(value.kind)) {
      pixiAppSettings.setEditorInteractionState({
        ...pixiAppSettings.editorInteractionState,
        annotationState: `calendar${value.kind === 'date time' ? '-time' : ''}`,
      });
    }
    pixiAppSettings.changeInput(true, cell, cursorMode);
  }
}
