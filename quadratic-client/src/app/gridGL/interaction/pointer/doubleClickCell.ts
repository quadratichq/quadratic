import { hasPermissionToEditFile } from '@/app/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import type { CursorMode } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

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
  const codeCell = content.cellsSheet.tables.getCodeCellIntersects({ x: column, y: row });
  let language: CodeCellLanguage | undefined = codeCell?.language;

  // Check if it's a single-cell code cell (1x1 with no table UI)
  let isSingleCell =
    codeCell !== undefined && codeCell.w === 1 && codeCell.h === 1 && !codeCell.show_name && !codeCell.show_columns;

  // If not found in client-side cache, check if it's a single-cell code cell via core API
  // We also capture the code so we can pass it as initialCode (avoids a second API call)
  let singleCellCode: string | undefined;
  if (!language) {
    const editCell = await quadraticCore.getEditCell(sheets.current, column, row);
    if (editCell?.codeCell) {
      language = editCell.codeCell.language;
      singleCellCode = editCell.codeCell.code;
      isSingleCell = true;
    }
  }

  // Open the correct code editor
  if (language) {
    pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();

    const formula = language === 'Formula';
    const file_import = language === 'Import';

    // For single-cell code cells detected via getEditCell, use the clicked position
    // For table code cells, use the table's anchor position
    const codeCellX = codeCell?.x ?? column;
    const codeCellY = codeCell?.y ?? row;
    const lastModified = codeCell ? Number(codeCell.last_modified) : Date.now();

    if (pixiAppSettings.codeEditorState.showCodeEditor && !file_import) {
      pixiAppSettings.setCodeEditorState({
        ...pixiAppSettings.codeEditorState,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
        },
        escapePressed: false,
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: codeCellX, y: codeCellY },
            language,
            lastModified,
            isSingleCell,
          },
          showCellTypeMenu: false,
          initialCode: singleCellCode ?? '',
          inlineEditor: formula,
        },
      });
    } else {
      if (hasPermission && formula) {
        const cursor = sheets.sheet.cursor.position;

        // ensure we're in the right cell (which may change if we double clicked on a CodeRun)
        if (cursor.x !== codeCellX || cursor.y !== codeCellY) {
          sheets.sheet.cursor.moveTo(codeCellX, codeCellY, { checkForTableRef: true });
        }
        pixiAppSettings.changeInput(true, cell, cursorMode);
      }
      // editing inside data table (only applies to table code cells, not single-cell)
      else if (hasPermission && file_import && codeCell) {
        // can't create formula inside data table
        if (cell?.startsWith('=')) {
          pixiAppSettings.snackbar('Cannot create formula inside table', { severity: 'error' });
        }

        // check column header or table value
        else {
          const isSpillOrError =
            codeCell.spill_error || codeCell.state === 'RunError' || codeCell.state === 'SpillError';
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
        }
      } else {
        pixiAppSettings.setCodeEditorState({
          ...pixiAppSettings.codeEditorState,
          aiAssistant: {
            abortController: undefined,
            loading: false,
            id: '',
            messages: [],
            waitingOnMessageIndex: undefined,
          },
          showCodeEditor: true,
          escapePressed: false,
          diffEditorContent: undefined,
          waitingForEditorClose: {
            codeCell: {
              sheetId: sheets.current,
              pos: { x: codeCellX, y: codeCellY },
              language,
              lastModified,
              isSingleCell,
            },
            initialCode: singleCellCode ?? '',
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
