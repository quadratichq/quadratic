import { hasPermissionToEditFile } from '@/app/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import type { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';

export async function doubleClickCell(options: {
  column: number;
  row: number;
  cell?: string;
  cursorMode?: CursorMode;
}) {
  let { column, row, cell, cursorMode } = options;

  if (inlineEditorHandler.isEditingFormula()) {
    return;
  }

  if (multiplayer.cellIsBeingEdited(column, row, sheets.current)) {
    return;
  }

  if (!pixiAppSettings.setEditorInteractionState || !pixiAppSettings.setCodeEditorState) {
    return;
  }

  const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);
  const codeCell = pixiApp.cellsSheet().tables.getCodeCellIntersects({ x: column, y: row });
  const language = codeCell?.language;

  // Open the correct code editor
  if (language) {
    pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();

    const formula = language === 'Formula';
    const file_import = language === 'Import';

    if (pixiAppSettings.codeEditorState.showCodeEditor && !file_import) {
      pixiAppSettings.setCodeEditorState({
        ...pixiAppSettings.codeEditorState,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
          delaySeconds: 0,
        },
        escapePressed: false,
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: codeCell.x, y: codeCell.y },
            language,
            lastModified: Number(codeCell.last_modified),
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
        if (codeCell && (cursor.x !== codeCell.x || cursor.y !== codeCell.y)) {
          sheets.sheet.cursor.moveTo(codeCell.x, codeCell.y, { checkForTableRef: true });
        }
        pixiAppSettings.changeInput(true, cell, cursorMode);
      }
      // editing inside data table
      else if (hasPermission && file_import) {
        // can't create formula inside data table
        // if (cell?.startsWith('=')) {
        //   pixiAppSettings.snackbar('Cannot create formula inside table', { severity: 'error' });
        // }

        // check column header or table value
        // else {
        const isSpillOrError = codeCell.spill_error || codeCell.state === 'RunError' || codeCell.state === 'SpillError';
        const isTableName = codeCell.show_name && row === codeCell.y;
        const isColumnHeader = codeCell.show_columns && row === codeCell.y + (codeCell.show_name ? 1 : 0);

        if (isSpillOrError) {
          return;
        } else if (isTableName) {
          events.emit('contextMenu', {
            type: ContextMenuType.Table,
            table: codeCell,
            rename: true,
            column: codeCell.x,
            row: codeCell.y,
            initialValue: cell,
          });
        } else if (isColumnHeader) {
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
        // }
      } else {
        pixiAppSettings.setCodeEditorState({
          ...pixiAppSettings.codeEditorState,
          aiAssistant: {
            abortController: undefined,
            loading: false,
            id: '',
            messages: [],
            waitingOnMessageIndex: undefined,
            delaySeconds: 0,
          },
          showCodeEditor: true,
          escapePressed: false,
          diffEditorContent: undefined,
          waitingForEditorClose: {
            codeCell: {
              sheetId: sheets.current,
              pos: { x: codeCell.x, y: codeCell.y },
              language,
              lastModified: Number(codeCell.last_modified),
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
    pixiAppSettings.changeInput(true, cell, cursorMode);
  }
}
