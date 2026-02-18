import { getConditionalFormatsToolCall, updateConditionalFormatsToolCall } from '@/app/ai/tools/aiConditionalFormats';
import {
  addDateTimeValidationToolCall,
  addListValidationToolCall,
  addLogicalValidationToolCall,
  addMessageToolCall,
  addNumberValidationToolCall,
  addTextValidationToolCall,
  getValidationsToolCall,
  removeValidationsToolCall,
} from '@/app/ai/tools/aiValidations';
import { describeFormatUpdates, expectedEnum } from '@/app/ai/tools/formatUpdate';
import { PlaidDocs, getConnectionSchemaMarkdown, getConnectionTableInfo } from '@/app/ai/utils/aiConnectionContext';
import { AICellResultToMarkdown } from '@/app/ai/utils/aiToMarkdown';
import { codeCellToMarkdown } from '@/app/ai/utils/codeCellToMarkdown';
import { countWords } from '@/app/ai/utils/wordCount';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { ColumnRowResize } from '@/app/gridGL/interaction/pointer/PointerHeading';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type {
  BorderStyle,
  CellAlign,
  CellVerticalAlign,
  CellWrap,
  FormatUpdate,
  JsCoordinate,
  JsDataTableColumnHeader,
  JsSheetPosText,
  NumericFormat,
  NumericFormatKind,
  SheetPos,
  SheetRect,
} from '@/app/quadratic-core-types';
import {
  columnNameToIndex,
  convertTableToSheetPos,
  xyToA1,
  type JsSelection,
} from '@/app/quadratic-core/quadratic_core';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { apiClient } from '@/shared/api/apiClient';
import {
  CELL_HEIGHT,
  CELL_TEXT_MARGIN_LEFT,
  CELL_WIDTH,
  FONT_SIZE_DISPLAY_ADJUSTMENT,
  MIN_CELL_WIDTH,
} from '@/shared/constants/gridConstants';
import Color from 'color';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AISource, ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import type { z } from 'zod';

const waitForSetCodeCellValue = (transactionId: string) => {
  return new Promise((resolve) => {
    const isTransactionRunning = pixiAppSettings.editorInteractionState.transactionsInfo.some(
      (t) => t.transactionId === transactionId
    );
    if (!isTransactionRunning) {
      resolve(undefined);
    } else {
      events.once('transactionEndUpdated', (transactionInfoId) => {
        if (transactionInfoId === transactionId) {
          resolve(undefined);
        } else {
          waitForSetCodeCellValue(transactionId).then(resolve);
        }
      });
    }
  });
};

const setCodeCellResult = async (
  sheetId: string,
  x: number,
  y: number,
  messageMetaData: AIToolMessageMetaData
): Promise<ToolResultContent> => {
  const tableCodeCell = content.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
  const codeCell = tableCodeCell
    ? await quadraticCore.getCodeCell(sheetId, tableCodeCell.x, tableCodeCell.y)
    : undefined;
  if (!tableCodeCell || !codeCell) {
    return [createTextContent('Error executing set code cell value tool')];
  }

  if (codeCell.std_err || codeCell.spill_error) {
    // log code run error in analytics, if enabled
    const aiAnalyticsSettings = pixiAppSettings.editorInteractionState.settings.analyticsAi;
    if (aiAnalyticsSettings && !!messageMetaData.chatId && messageMetaData.messageIndex >= 0) {
      const codeRunError = JSON.stringify({
        code_string: codeCell.code_string,
        std_err: codeCell.std_err,
        spill_error: codeCell.spill_error,
      });
      apiClient.ai.codeRunError({
        chatId: messageMetaData.chatId,
        messageIndex: messageMetaData.messageIndex,
        codeRunError,
      });
    }
  }

  if (codeCell.std_err) {
    return [
      createTextContent(
        `The code cell run has resulted in an error:
\`\`\`
${codeCell.std_err}
\`\`\`
Think and reason about the error and try to fix it. Do not attempt the same fix repeatedly. If it failed once, it will fail again.
`
      ),
    ];
  }

  if (codeCell.spill_error) {
    return [
      createTextContent(
        `
The code cell has spilled, because the output overlaps with existing data on the sheet.
Output size when not spilled will be ${tableCodeCell.w} cells wide and ${tableCodeCell.h} cells high.\n
Use the move tool to move just the single cell position of the code you attempted to place to a new position.\n
This should be a single cell, not a range. E.g. if you're moving the code cell you placed at C1 to G1 then you should move to G1:G1.\n
Move the code cell to a new position that will avoid spilling. Make sure the new position is not overlapping with existing data on the sheet. Do not attempt the same location repeatedly. Attempt new locations until the spill is resolved.
`
      ),
    ];
  }

  if (tableCodeCell.is_html) {
    return [createTextContent('Executed set code cell value tool successfully to create a plotly chart.')];
  } else if (tableCodeCell.is_html_image) {
    return [createTextContent('Executed set code cell value tool successfully to create a javascript chart.')];
  }

  // single cell output
  if (tableCodeCell.w === 1 && tableCodeCell.h === 1) {
    const singleCell = await quadraticCore.getCellValue(sheetId, x, y);
    if (singleCell === undefined || singleCell.value === '') {
      return [
        createTextContent(
          'You returned a single empty cell. Was this on purpose? If not, you may have mistakenly not put what you want to return as the last line of code. It cannot be nested in a conditional. If you used if-else or try-catch, delete the conditionals unless the user explicitly asked for them. It must be outside all functions or conditionals as the very last line of code.'
        ),
      ];
    }
    return [createTextContent(`Output is: ${singleCell.value}`)];
  }

  // multiple cell output
  return [createTextContent(`Output size is ${tableCodeCell.w} cells wide and ${tableCodeCell.h} cells high.`)];
};

function getMergeCellError(sheetId: string, x: number, y: number): string | null {
  const sheet = sheets.getById(sheetId);
  if (!sheet) return `Error: Sheet with id ${sheetId} not found.`;
  const mergeRect = sheet.getMergeCellRect(x, y);
  if (!mergeRect) return null;
  const anchor = { x: Number(mergeRect.min.x), y: Number(mergeRect.min.y) };
  if (anchor.x === x && anchor.y === y) return null;
  const cellA1 = xyToA1(x, y);
  const anchorA1 = xyToA1(anchor.x, anchor.y);
  const mergeA1 = `${anchorA1}:${xyToA1(Number(mergeRect.max.x), Number(mergeRect.max.y))}`;
  return `Error: Cell ${cellA1} is inside merged region ${mergeA1}. To write to this merged cell, use the anchor cell ${anchorA1} instead.`;
}

function getMergeCellErrorContent(sheetId: string, x: number, y: number): ToolResultContent | null {
  const error = getMergeCellError(sheetId, x, y);
  return error ? [createTextContent(error)] : null;
}

function checkCellValuesMergeErrors(
  sheetId: string,
  originX: number,
  originY: number,
  cellValues: string[][]
): ToolResultContent | null {
  for (let row = 0; row < cellValues.length; row++) {
    for (let col = 0; col < cellValues[row].length; col++) {
      if (!cellValues[row][col]) continue;
      const result = getMergeCellErrorContent(sheetId, originX + col, originY + row);
      if (result) return result;
    }
  }
  return null;
}

type AIToolMessageMetaData = {
  source: AISource;
  chatId: string;
  messageIndex: number;
};

export type AIToolActionsRecord = {
  [K in AITool]: (
    args: z.infer<(typeof AIToolsArgsSchema)[K]>,
    messageMetaData: AIToolMessageMetaData
  ) => Promise<ToolResultContent>;
};

export const aiToolsActions: AIToolActionsRecord = {
  [AITool.SetAIModel]: async (args) => {
    // no action as this tool is only meant to get structured data from AI
    return [createTextContent(`Executed set ai model tool successfully with name: ${args.ai_model}`)];
  },
  [AITool.SetChatName]: async (args) => {
    // no action as this tool is only meant to get structured data from AI
    return [createTextContent(`Executed set chat name tool successfully with name: ${args.chat_name}`)];
  },
  [AITool.SetFileName]: async (args) => {
    // Validate word count (1-3 words)
    const wordCount = countWords(args.file_name);

    if (wordCount < 1 || wordCount > 3) {
      return [
        createTextContent(
          `Error: File name must be 1-3 words. Received "${args.file_name}" which has ${wordCount} word(s). Please provide a shorter name.`
        ),
      ];
    }

    // no action as this tool is only meant to get structured data from AI
    return [createTextContent(`Executed set file name tool successfully with name: ${args.file_name}`)];
  },
  [AITool.AddDataTable]: async (args) => {
    try {
      const { sheet_name, top_left_position, table_name, table_data } = args;
      const sheetId = sheets.getSheetByName(sheet_name)?.id ?? sheets.current;
      const selection = sheets.stringToSelection(top_left_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }
      const { x, y } = selection.getCursor();

      if (table_data.length > 0 && table_data[0].length > 0) {
        await quadraticCore.addDataTable({
          sheetId,
          x,
          y,
          name: table_name,
          values: table_data,
          firstRowIsHeader: true,
          isAi: true,
        });

        const endX = x + table_data[0].length - 1;
        const endY = y + table_data.length; // Don't subtract 1 to include the full table
        ensureRectVisible(sheetId, { x, y }, { x: endX, y: endY });

        // Update AI cursor to show selection over entire table
        try {
          const rangeSelection = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
          const jsSelection = sheets.stringToSelection(rangeSelection, sheetId);
          const selectionString = jsSelection.save();
          aiUser.updateSelection(selectionString, sheetId);
        } catch (e) {
          console.warn('Failed to update AI user selection for data table:', e);
        }

        return [createTextContent(`Executed add data table tool successfully with name: ${table_name}`)];
      } else {
        return [createTextContent('data_table values are empty, cannot add data table without values')];
      }
    } catch (e) {
      return [createTextContent(`Error executing set cell values tool: ${e}`)];
    }
  },
  [AITool.SetCellValues]: async (args) => {
    try {
      const { sheet_name, top_left_position, cell_values } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(top_left_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }
      const { x, y } = selection.getCursor();

      // Check if any target cell is a non-anchor cell in a merged region
      if (cell_values.length > 0 && cell_values[0].length > 0) {
        const mergeError = checkCellValuesMergeErrors(sheetId, x, y, cell_values);
        if (mergeError) return mergeError;
      }

      if (cell_values.length > 0 && cell_values[0].length > 0) {
        // Move AI cursor to show the range being written
        try {
          const endX = x + cell_values[0].length - 1;
          const endY = y + cell_values.length - 1;
          const rangeSelection = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
          const jsSelection = sheets.stringToSelection(rangeSelection, sheetId);
          const selectionString = jsSelection.save();
          aiUser.updateSelection(selectionString, sheetId);
        } catch (e) {
          console.warn('Failed to update AI user selection:', e);
        }

        await quadraticCore.setCellValues(sheetId, x, y, cell_values, true);

        ensureRectVisible(sheetId, { x, y }, { x: x + cell_values[0].length - 1, y: y + cell_values.length - 1 });

        return [createTextContent('Executed set cell values tool successfully')];
      } else {
        return [createTextContent('cell_values are empty, cannot set cell values without values')];
      }
    } catch (e) {
      return [createTextContent(`Error executing set cell values tool: ${e}`)];
    }
  },
  [AITool.SetCodeCellValue]: async (args, messageMetaData) => {
    try {
      let { sheet_name, code_cell_name, code_cell_language, code_cell_position, code_string } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(code_cell_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }

      const { x, y } = selection.getCursor();

      const mergeError = getMergeCellErrorContent(sheetId, x, y);
      if (mergeError) return mergeError;

      // Move AI cursor to the code cell position
      try {
        const selectionString = selection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId,
        x,
        y,
        codeString: code_string,
        language: code_cell_language,
        codeCellName: code_cell_name,
        isAi: true,
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        // After execution, adjust viewport and cursor to show full output if it exists
        const tableCodeCell = content.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
        if (tableCodeCell) {
          const width = tableCodeCell.w;
          const height = tableCodeCell.h;
          ensureRectVisible(sheetId, { x, y }, { x: x + width - 1, y: y + height - 1 });

          // Update AI cursor to show selection over entire output area
          if (width > 1 || height > 1) {
            try {
              const endX = x + width - 1;
              const endY = y + height - 1;
              const rangeSelection = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
              const jsSelection = sheets.stringToSelection(rangeSelection, sheetId);
              const selectionString = jsSelection.save();
              aiUser.updateSelection(selectionString, sheetId);
            } catch (e) {
              console.warn('Failed to update AI user selection to full output range:', e);
            }
          }
        }

        const result = await setCodeCellResult(sheetId, x, y, messageMetaData);
        return result;
      } else {
        return [createTextContent('Error executing set code cell value tool')];
      }
    } catch (e) {
      return [createTextContent(`Error executing set code cell value tool: ${e}`)];
    }
  },
  [AITool.GetDatabaseSchemas]: async (args) => {
    const { connection_ids } = args;
    const connectionIds = connection_ids.filter((id) => !!id);

    // Get team UUID from the current context
    const teamUuid = pixiAppSettings.editorInteractionState.teamUuid;
    if (!teamUuid) {
      return [createTextContent('Unable to retrieve database schemas. Access to team is required.')];
    }

    // Get all team connections or specific ones
    let connections;
    try {
      const teamConnections = await apiClient.connections.list(teamUuid);
      connections =
        connectionIds.length > 0
          ? teamConnections.filter((connection) => connectionIds.includes(connection.uuid))
          : teamConnections;

      if (connections.length === 0) {
        return [
          createTextContent(
            `Error: ${connectionIds.length === 0 ? 'No database connections found for this team. Please set up database connections in the team settings first.' : 'None of the specified connection IDs were found or accessible. Make sure the connection IDs are correct. To see all available connections, call this tool with empty connection_ids array.'}`
          ),
        ];
      }
    } catch (connectionError) {
      console.warn('[GetDatabaseSchemas] Failed to fetch team connections:', connectionError);
      return [
        createTextContent(
          `Error: Unable to retrieve database connections. This could be because of network issues, please try again later. ${connectionError}`
        ),
      ];
    }

    try {
      // Get info for each connection
      const connectionsInfo = await Promise.all(
        connections.map((connection) => getConnectionTableInfo(connection, teamUuid))
      );

      // Filter out null results
      if (connectionsInfo.length === 0) {
        return [
          createTextContent(
            'No database schemas could be retrieved. All connections may be unavailable or have configuration issues.'
          ),
        ];
      }

      // Format the response
      const schemaText = connectionsInfo.map(getConnectionSchemaMarkdown).join('\n---\n\n');

      // Add connection-type-specific documentation
      const hasPlaidConnection = connectionsInfo.some(
        (info) => info.connectionType.toUpperCase() === 'PLAID' && !info.error
      );
      const connectionDocs = hasPlaidConnection ? `\n\n${PlaidDocs}` : '';

      // Add connection summary for future reference
      const connectionSummary = connectionsInfo
        .filter((item) => item && !item.error)
        .map((item) => `- ${item!.connectionName} (${item!.connectionType}): ${item!.connectionId}`)
        .join('\n');

      const summaryText = connectionSummary
        ? `\n\nAvailable connection IDs for future reference:\n${connectionSummary}`
        : '';

      return [
        createTextContent(
          schemaText
            ? `Database schemas retrieved successfully:\n\n${schemaText}${connectionDocs}${summaryText}`
            : `No database schema information available.${summaryText}`
        ),
      ];
    } catch (error) {
      console.error('[GetDatabaseSchemas] Unexpected error:', error);
      return [
        createTextContent(
          `Error retrieving database schemas: ${error instanceof Error ? error.message : String(error)}`
        ),
      ];
    }
  },
  [AITool.SetSQLCodeCellValue]: async (args, messageMetaData) => {
    try {
      let { sheet_name, code_cell_name, connection_kind, code_cell_position, sql_code_string, connection_id } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(code_cell_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }

      const { x, y } = selection.getCursor();

      const mergeError = getMergeCellErrorContent(sheetId, x, y);
      if (mergeError) return mergeError;

      // Move AI cursor to the code cell position
      try {
        const selectionString = selection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId,
        x,
        y,
        codeString: sql_code_string,
        language: {
          Connection: {
            kind: connection_kind,
            id: connection_id,
          },
        },
        codeCellName: code_cell_name,
        isAi: true,
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        // After execution, adjust viewport and cursor to show full output if it exists
        const tableCodeCell = content.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
        if (tableCodeCell) {
          const width = tableCodeCell.w;
          const height = tableCodeCell.h;
          ensureRectVisible(sheetId, { x, y }, { x: x + width - 1, y: y + height - 1 });

          // Update AI cursor to show selection over entire output area
          if (width > 1 || height > 1) {
            try {
              const endX = x + width - 1;
              const endY = y + height - 1;
              const rangeSelection = `${xyToA1(x, y)}:${xyToA1(endX, endY)}`;
              const jsSelection = sheets.stringToSelection(rangeSelection, sheetId);
              const selectionString = jsSelection.save();
              aiUser.updateSelection(selectionString, sheetId);
            } catch (e) {
              console.warn('Failed to update AI user selection to full output range:', e);
            }
          }
        }

        const result = await setCodeCellResult(sheetId, x, y, messageMetaData);
        return result;
      } else {
        return [createTextContent('Error executing set sql code cell value tool')];
      }
    } catch (e) {
      return [createTextContent(`Error executing set sql code cell value tool: ${e}`)];
    }
  },
  [AITool.SetFormulaCellValue]: async (args) => {
    try {
      const { formulas } = args;

      // Check if any formula targets a non-anchor cell in a merged region
      for (const formula of formulas) {
        const sheetId = formula.sheet_name
          ? (sheets.getSheetByName(formula.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        try {
          const sel = sheets.stringToSelection(formula.code_cell_position, sheetId);
          const rect = sel.getSingleRectangleOrCursor(sheets.jsA1Context);
          if (rect) {
            for (let y = Number(rect.min.y); y <= Number(rect.max.y); y++) {
              for (let x = Number(rect.min.x); x <= Number(rect.max.x); x++) {
                const mergeError = getMergeCellErrorContent(sheetId, x, y);
                if (mergeError) return mergeError;
              }
            }
          }
        } catch {
          // position parsing will be handled downstream
        }
      }

      // Group formulas by sheet
      const formulasBySheet = new Map<string, Array<{ selection: string; codeString: string }>>();
      for (const formula of formulas) {
        const sheetId = formula.sheet_name
          ? (sheets.getSheetByName(formula.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        if (!formulasBySheet.has(sheetId)) {
          formulasBySheet.set(sheetId, []);
        }
        formulasBySheet.get(sheetId)!.push({
          selection: formula.code_cell_position,
          codeString: formula.formula_string,
        });
      }

      // Move AI cursor to the first formula cell position
      if (formulas.length > 0) {
        const firstSheetId = formulas[0].sheet_name
          ? (sheets.getSheetByName(formulas[0].sheet_name)?.id ?? sheets.current)
          : sheets.current;
        try {
          const jsSelection = sheets.stringToSelection(formulas[0].code_cell_position, firstSheetId);
          const selectionString = jsSelection.save();
          aiUser.updateSelection(selectionString, firstSheetId);
        } catch (e) {
          console.warn('Failed to update AI user selection:', e);
        }
      }

      // Execute formulas for each sheet
      const transactionIds: string[] = [];
      for (const [sheetId, sheetFormulas] of formulasBySheet) {
        const transactionId = await quadraticCore.setFormulas({
          sheetId,
          formulas: sheetFormulas,
        });
        if (transactionId) {
          transactionIds.push(transactionId);
        }
      }

      const positions = formulas.map((f) => f.code_cell_position).join(', ');

      if (transactionIds.length > 0) {
        // Wait for all transactions to complete
        await Promise.all(transactionIds.map((id) => waitForSetCodeCellValue(id)));
        return [
          createTextContent(
            `Successfully set formula cells in ${positions}. The results of the formula cells are contained with the context above.`
          ),
        ];
      } else {
        return [createTextContent(`Error executing set formula cell value tool for ${positions}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing set formula cell value tool: ${e}`)];
    }
  },
  [AITool.MoveCells]: async (args) => {
    try {
      const { sheet_name, moves, source_selection_rect, target_top_left_position } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      // Helper to parse a single move
      const parseMove = (sourceRect: string, targetPos: string) => {
        const sourceSelection = sheets.stringToSelection(sourceRect, sheetId);
        const rect = sourceSelection.getSingleRectangleOrCursor(sheets.jsA1Context);
        if (!rect) {
          throw new Error(`Invalid source selection "${sourceRect}", this should be a single rectangle, not a range`);
        }
        const sheetRect: SheetRect = {
          min: { x: rect.min.x, y: rect.min.y },
          max: { x: rect.max.x, y: rect.max.y },
          sheet_id: { id: sheetId },
        };
        const targetSelection = sheets.stringToSelection(targetPos, sheetId);
        if (!targetSelection.isSingleSelection(sheets.jsA1Context)) {
          throw new Error(`Invalid target position "${targetPos}", this should be a single cell, not a range`);
        }
        const { x, y } = targetSelection.getCursor();
        return {
          sheetRect,
          x,
          y,
          rangeWidth: Number(rect.max.x - rect.min.x),
          rangeHeight: Number(rect.max.y - rect.min.y),
        };
      };

      // Support both new format (moves array) and old format (source_selection_rect/target_top_left_position)
      let movesToProcess: { source_selection_rect: string; target_top_left_position: string }[];
      if (moves && moves.length > 0) {
        movesToProcess = moves;
      } else if (source_selection_rect && target_top_left_position) {
        // Backward compatibility: convert old format to moves array
        movesToProcess = [{ source_selection_rect, target_top_left_position }];
      } else {
        return [
          createTextContent(
            'Invalid arguments: provide either moves array or source_selection_rect and target_top_left_position'
          ),
        ];
      }

      // Parse all moves and collect errors - this way we can report all invalid moves, not just the first one
      const parseResults = movesToProcess.map((m, index) => {
        try {
          return { success: true as const, data: parseMove(m.source_selection_rect, m.target_top_left_position) };
        } catch (e) {
          return {
            success: false as const,
            error: `Move ${index + 1} (${m.source_selection_rect} → ${m.target_top_left_position}): ${e instanceof Error ? e.message : String(e)}`,
          };
        }
      });

      const errors = parseResults.filter((r) => !r.success);
      if (errors.length > 0) {
        const errorMessages = errors.map((e) => (e.success ? '' : e.error)).join('\n');
        return [createTextContent(`Invalid move(s):\n${errorMessages}`)];
      }

      const parsedMoves = parseResults
        .filter((r): r is { success: true; data: ReturnType<typeof parseMove> } => r.success)
        .map((r) => r.data);

      // Move AI cursor to show the first target destination
      const first = parsedMoves[0];
      try {
        const targetRange = `${xyToA1(first.x, first.y)}:${xyToA1(first.x + first.rangeWidth, first.y + first.rangeHeight)}`;
        const jsSelection = sheets.stringToSelection(targetRange, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      await quadraticCore.moveCellsBatch(
        parsedMoves.map((m) => ({
          source: m.sheetRect,
          targetX: m.x,
          targetY: m.y,
          targetSheetId: sheetId,
        })),
        true
      );

      // Move viewport to the first target destination
      ensureRectVisible(
        sheetId,
        { x: first.x, y: first.y },
        { x: first.x + first.rangeWidth, y: first.y + first.rangeHeight }
      );

      return [createTextContent(`Executed move cells tool successfully for ${movesToProcess.length} move(s).`)];
    } catch (e) {
      return [createTextContent(`Error executing move cells tool: ${e}`)];
    }
  },
  [AITool.DeleteCells]: async (args) => {
    try {
      const { sheet_name, selection } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      // Move AI cursor to the cells being deleted
      try {
        const jsSelection = sheets.stringToSelection(selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      const sourceSelection = sheets.stringToSelection(selection, sheetId).save();
      const response = await quadraticCore.deleteCellValues(sourceSelection, true);
      if (response?.result) {
        return [createTextContent(`The selection ${args.selection} was deleted successfully.`)];
      } else {
        return [createTextContent(`There was an error executing the delete cells tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing delete cells tool: ${e}`)];
    }
  },
  [AITool.UpdateCodeCell]: async (args, messageMetaData) => {
    try {
      if (!pixiAppSettings.setCodeEditorState) {
        throw new Error('setCodeEditorState is not defined');
      }

      const { code_string } = args;

      const editorContent = pixiAppSettings.codeEditorState.diffEditorContent?.isApplied
        ? pixiAppSettings.codeEditorState.diffEditorContent.editorContent
        : pixiAppSettings.codeEditorState.editorContent;

      const codeCell = pixiAppSettings.codeEditorState.codeCell;

      // Move AI cursor to the code cell being updated
      try {
        const cellA1 = xyToA1(codeCell.pos.x, codeCell.pos.y);
        const jsSelection = sheets.stringToSelection(cellA1, codeCell.sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, codeCell.sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        diffEditorContent: { editorContent, isApplied: true },
        waitingForEditorClose: {
          codeCell,
          showCellTypeMenu: false,
          initialCode: code_string,
          inlineEditor: false,
        },
      }));

      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId: codeCell.sheetId,
        x: codeCell.pos.x,
        y: codeCell.pos.y,
        codeString: code_string,
        language: codeCell.language,
        isAi: true,
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        const result = await setCodeCellResult(codeCell.sheetId, codeCell.pos.x, codeCell.pos.y, messageMetaData);

        return [
          ...result,
          createTextContent(
            'User is presented with diff editor, with accept and reject buttons, to revert the changes if needed'
          ),
        ];
      } else {
        return [createTextContent('Error executing update code cell tool')];
      }
    } catch (e) {
      return [createTextContent(`Error executing update code cell tool: ${e}`)];
    }
  },
  [AITool.CodeEditorCompletions]: async () => {
    return [
      createTextContent(
        'Code editor completions tool executed successfully, user is presented with a list of code completions, to choose from.'
      ),
    ];
  },
  [AITool.UserPromptSuggestions]: async () => {
    return [
      createTextContent(
        'User prompt suggestions tool executed successfully, user is presented with a list of prompt suggestions, to choose from.'
      ),
    ];
  },
  [AITool.EmptyChatPromptSuggestions]: async () => {
    return [
      createTextContent(
        'Empty chat prompt suggestions tool executed successfully, user is presented with a list of prompt suggestions, to choose from.'
      ),
    ];
  },
  [AITool.CategorizedEmptyChatPromptSuggestions]: async () => {
    return [
      createTextContent(
        'Categorized empty chat prompt suggestions tool executed successfully, user is presented with categorized prompt suggestions to choose from.'
      ),
    ];
  },
  [AITool.PDFImport]: async () => {
    return [createTextContent('PDF import tool executed successfully.')];
  },
  [AITool.GetCellData]: async (args) => {
    try {
      const { selection, sheet_name, page } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      // Move AI cursor to the starting cell and show selection
      try {
        const jsSelection = sheets.stringToSelection(selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      const response = await quadraticCore.getAICells(selection, sheetId, page);
      if (!response || typeof response === 'string' || ('error' in response && response.error)) {
        const error = typeof response === 'string' ? response : response?.error;
        return [createTextContent(`There was an error executing the get cells tool ${error}`)];
      } else if ('values' in response) {
        return [createTextContent(AICellResultToMarkdown(response))];
      } else {
        // should not be reached
        return [createTextContent('There was an error executing the get cells tool')];
      }
    } catch (e) {
      return [createTextContent(`Error executing get cell data tool: ${e}`)];
    }
  },
  [AITool.SetTextFormats]: async (args) => {
    try {
      if (!args.formats || args.formats.length === 0) {
        return [createTextContent('Error: At least one format entry is required.')];
      }

      const formatEntries: { sheetId: string; selection: string; formats: FormatUpdate }[] = [];
      const descriptions: string[] = [];

      for (const formatEntry of args.formats) {
        let numericFormat: NumericFormat | null = null;
        if (formatEntry.number_type !== undefined) {
          const kind = formatEntry.number_type
            ? expectedEnum<NumericFormatKind>(formatEntry.number_type, [
                'NUMBER',
                'CURRENCY',
                'PERCENTAGE',
                'EXPONENTIAL',
              ])
            : null;
          if (kind) {
            numericFormat = {
              type: kind,
              symbol: formatEntry.currency_symbol ?? null,
            };
          } else {
            numericFormat = null;
          }
        }
        const formatUpdates = {
          ...(formatEntry.bold !== undefined && { bold: formatEntry.bold }),
          ...(formatEntry.italic !== undefined && { italic: formatEntry.italic }),
          ...(formatEntry.underline !== undefined && { underline: formatEntry.underline }),
          ...(formatEntry.strike_through !== undefined && { strike_through: formatEntry.strike_through }),
          ...(formatEntry.text_color !== undefined && { text_color: formatEntry.text_color }),
          ...(formatEntry.fill_color !== undefined && { fill_color: formatEntry.fill_color }),
          ...(formatEntry.align !== undefined && {
            align: formatEntry.align ? expectedEnum<CellAlign>(formatEntry.align, ['left', 'center', 'right']) : null,
          }),
          ...(formatEntry.vertical_align !== undefined && {
            vertical_align: formatEntry.vertical_align
              ? expectedEnum<CellVerticalAlign>(formatEntry.vertical_align, ['top', 'middle', 'bottom'])
              : null,
          }),
          ...(formatEntry.wrap !== undefined && {
            wrap: formatEntry.wrap ? expectedEnum<CellWrap>(formatEntry.wrap, ['wrap', 'overflow', 'clip']) : null,
          }),
          ...(formatEntry.numeric_commas !== undefined && { numeric_commas: formatEntry.numeric_commas }),
          ...(formatEntry.number_type !== undefined && { numeric_format: numericFormat }),
          ...(formatEntry.date_time !== undefined && { date_time: formatEntry.date_time }),
          // Convert user-facing font size to internal (AI thinks in user-facing values like the UI)
          ...(formatEntry.font_size !== undefined && {
            font_size: formatEntry.font_size !== null ? formatEntry.font_size - FONT_SIZE_DISPLAY_ADJUSTMENT : null,
          }),
        } as FormatUpdate;

        const sheetId = formatEntry.sheet_name
          ? (sheets.getSheetByName(formatEntry.sheet_name)?.id ?? sheets.current)
          : sheets.current;

        formatEntries.push({
          sheetId,
          selection: formatEntry.selection,
          formats: formatUpdates,
        });

        descriptions.push(`${formatEntry.selection}: ${describeFormatUpdates(formatUpdates, formatEntry)}`);
      }

      // Move AI cursor to the last selection
      if (formatEntries.length > 0) {
        const lastEntry = formatEntries[formatEntries.length - 1];
        try {
          const jsSelection = sheets.stringToSelection(lastEntry.selection, lastEntry.sheetId);
          const selectionString = jsSelection.save();
          aiUser.updateSelection(selectionString, lastEntry.sheetId);
        } catch (e) {
          console.warn('Failed to update AI user selection:', e);
        }
      }

      // Execute all formats in a single transaction
      const response = await quadraticCore.setFormatsA1(formatEntries, true);
      if (response?.result) {
        return [createTextContent(`Set formats completed successfully:\n${descriptions.join('\n')}`)];
      } else {
        return [createTextContent(`There was an error executing the set formats tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing set formats tool: ${e}`)];
    }
  },
  [AITool.GetTextFormats]: async (args) => {
    try {
      const sheetId = args.sheet_name ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current) : sheets.current;

      // Move AI cursor to the cells being read
      try {
        const jsSelection = sheets.stringToSelection(args.selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      const response = await quadraticCore.getAICellFormats(sheetId, args.selection, args.page);
      if (typeof response === 'string') {
        return [createTextContent(`The selection ${args.selection} has:\n${response}`)];
      } else {
        return [createTextContent(`There was an error executing the get cell formats tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing get text formats tool: ${e}`)];
    }
  },
  [AITool.ConvertToTable]: async (args) => {
    try {
      const sheetId = args.sheet_name ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current) : sheets.current;
      const sheetRect = sheets.selectionToSheetRectString(sheetId, args.selection);
      if (!sheetRect) {
        return [createTextContent('Invalid selection, this should be a single rectangle, not a range')];
      }
      const response = await quadraticCore.gridToDataTable(
        sheetRect,
        args.table_name,
        args.first_row_is_column_names,
        true
      );
      if (response?.result) {
        return [createTextContent('Converted sheet data to table.')];
      } else {
        return [createTextContent(`Error executing convert to table tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing convert to table tool: ${e}`)];
    }
  },
  [AITool.WebSearch]: async (args) => {
    return [createTextContent('Search tool executed successfully.')];
  },
  [AITool.WebSearchInternal]: async (args) => {
    return [createTextContent('Web search tool executed successfully.')];
  },
  [AITool.AddSheet]: async (args) => {
    try {
      const { sheet_name, insert_before_sheet_name } = args;
      const response = await quadraticCore.addSheet(sheet_name, insert_before_sheet_name ?? undefined, true);
      if (response?.result) {
        // Move AI cursor to the new sheet at A1
        try {
          const newSheetId = sheets.getSheetByName(sheet_name)?.id;
          if (newSheetId) {
            const jsSelection = sheets.stringToSelection('A1', newSheetId);
            const selectionString = jsSelection.save();
            aiUser.updateSelection(selectionString, newSheetId);
          }
        } catch (e) {
          console.warn('Failed to update AI cursor to new sheet:', e);
        }
        return [createTextContent('Create new sheet tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing add sheet tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing add sheet tool: ${e}`)];
    }
  },
  [AITool.DuplicateSheet]: async (args) => {
    try {
      const { sheet_name_to_duplicate, name_of_new_sheet } = args;
      const sheetId = sheets.getSheetIdFromName(sheet_name_to_duplicate);
      if (!sheetId) {
        return [createTextContent('Error executing duplicate sheet tool, sheet not found')];
      }
      const response = await quadraticCore.duplicateSheet(sheetId, name_of_new_sheet, true);
      if (response?.result) {
        // Move AI cursor to the duplicated sheet at A1
        try {
          const newSheetId = sheets.getSheetByName(name_of_new_sheet)?.id;
          if (newSheetId) {
            const jsSelection = sheets.stringToSelection('A1', newSheetId);
            const selectionString = jsSelection.save();
            aiUser.updateSelection(selectionString, newSheetId);
          }
        } catch (e) {
          console.warn('Failed to update AI cursor to duplicated sheet:', e);
        }
        return [createTextContent('Duplicate sheet tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing duplicate sheet tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing duplicate sheet tool: ${e}`)];
    }
  },
  [AITool.RenameSheet]: async (args) => {
    try {
      const { sheet_name, new_name } = args;
      const sheetId = sheets.getSheetIdFromName(sheet_name);
      if (!sheetId) {
        return [createTextContent('Error executing rename sheet tool, sheet not found')];
      }
      const response = await quadraticCore.setSheetName(sheetId, new_name, true);
      if (response?.result) {
        return [createTextContent('Rename sheet tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing rename sheet tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing rename sheet tool: ${e}`)];
    }
  },
  [AITool.DeleteSheet]: async (args) => {
    try {
      const { sheet_name } = args;
      const sheetId = sheets.getSheetIdFromName(sheet_name);
      if (!sheetId) {
        return [createTextContent('Error executing delete sheet tool, sheet not found')];
      }
      const response = await quadraticCore.deleteSheet(sheetId, true);
      if (response?.result) {
        return [createTextContent('Delete sheet tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing delete sheet tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing delete sheet tool: ${e}`)];
    }
  },
  [AITool.MoveSheet]: async (args) => {
    try {
      const { sheet_name, insert_before_sheet_name } = args;
      const sheetId = sheets.getSheetIdFromName(sheet_name);
      const insertBeforeSheetId = insert_before_sheet_name
        ? sheets.getSheetIdFromName(insert_before_sheet_name)
        : undefined;
      if (!sheetId) {
        return [createTextContent('Error executing move sheet tool, sheet not found')];
      }
      const response = await quadraticCore.moveSheet(sheetId, insertBeforeSheetId, true);
      if (response?.result) {
        return [createTextContent('Move sheet tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing move sheet tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing move sheet tool: ${e}`)];
    }
  },
  [AITool.ColorSheets]: async (args) => {
    try {
      const { sheet_names_to_color } = args;
      const response = await quadraticCore.setSheetsColor(sheet_names_to_color, true);
      if (response?.result) {
        return [createTextContent('Color sheets tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing color sheets tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing color sheets tool: ${e}`)];
    }
  },
  [AITool.TextSearch]: async (args) => {
    try {
      const { query, case_sensitive, whole_cell, search_code, sheet_name } = args;
      let sheet_id = null;
      if (sheet_name) {
        sheet_id = sheets.getSheetIdFromName(sheet_name) ?? null;
        if (sheet_id === '') {
          sheet_id = null;
        }
      }

      const results = await quadraticCore.search(query, {
        case_sensitive: case_sensitive ?? null,
        whole_cell: whole_cell ?? null,
        search_code: search_code ?? null,
        sheet_id,
      });

      const sortedResults: Record<string, JsSheetPosText[]> = {};
      results.forEach((result) => {
        if (!sortedResults[result.sheet_id]) {
          sortedResults[result.sheet_id] = [];
        }
        sortedResults[result.sheet_id].push(result);
      });

      const text = Object.entries(sortedResults)
        .map(([sheet_id, results]) => {
          const sheet = sheets.getById(sheet_id);
          if (sheet) {
            return `For Sheet "${sheet.name}": ${results
              .map((result) => `Cell: ${xyToA1(Number(result.x), Number(result.y))} is "${result.text}"`)
              .join(', ')}`;
          } else {
            return '';
          }
        })
        .join('.\n');
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing text search tool: ${e}`)];
    }
  },
  [AITool.HasCellData]: async (args) => {
    try {
      const { selection, sheet_name } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const response = await quadraticCore.hasCellData(sheetId, selection);
      return [
        createTextContent(
          response
            ? `The selection "${args.selection}" in Sheet "${args.sheet_name}" has data.`
            : `The selection "${args.selection}" in Sheet "${args.sheet_name}" does not have data.`
        ),
      ];
    } catch (e) {
      return [createTextContent(`Error executing has cell data tool: ${e}`)];
    }
  },
  [AITool.RerunCode]: async (args) => {
    try {
      const { sheet_name, selection } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : undefined;
      const response = await quadraticCore.rerunCodeCells(sheetId, selection ?? undefined, true);
      if (typeof response === 'string') {
        await waitForSetCodeCellValue(response);
        const text =
          sheet_name && selection
            ? `Code in sheet "${sheet_name}" within selection "${selection}" has been rerun.`
            : sheet_name && !selection
              ? `Code in sheet "${sheet_name}" has been rerun.`
              : 'Code in all sheets has been rerun.';
        return [createTextContent(text)];
      } else {
        return [createTextContent(`There was an error executing the rerun code tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing rerun code tool: ${e}`)];
    }
  },
  [AITool.ResizeColumns]: async (args) => {
    try {
      const { sheet_name, selection, size } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      let jsSelection: JsSelection | undefined;
      try {
        jsSelection = sheets.stringToSelection(selection, sheetId);
      } catch (e: any) {
        return [createTextContent(`Error executing resize columns tool. Invalid selection: ${e.message}.`)];
      }

      let columns: Uint32Array;
      try {
        columns = jsSelection.getColumnsWithSelectedCells(sheets.jsA1Context);
      } catch (e: any) {
        return [
          createTextContent(`Error executing resize columns tool. Unable to get selected columns: ${e.message}.`),
        ];
      }

      if (columns.length === 0) {
        return [createTextContent('No columns selected.')];
      }

      const resizing: ColumnRowResize[] = [];
      for (const column of columns) {
        let newSize: number;
        if (size === 'auto') {
          const maxWidth = await content.cellsSheets.getCellsContentMaxWidth(column);
          if (maxWidth === 0) {
            newSize = CELL_WIDTH;
          } else {
            const contentSizePlusMargin = maxWidth + CELL_TEXT_MARGIN_LEFT * 3;
            newSize = Math.max(contentSizePlusMargin, MIN_CELL_WIDTH);
          }
        } else {
          newSize = CELL_WIDTH;
        }

        const originalSize = sheets.sheet.offsets.getColumnWidth(column);
        if (originalSize !== newSize) {
          resizing.push({ index: column, size: newSize });
        }
      }

      if (resizing.length) {
        const response = await quadraticCore.resizeColumns(sheetId, resizing, true);
        if (response?.result) {
          return [createTextContent(`Resize columns tool executed successfully.`)];
        } else {
          return [createTextContent(`Error executing resize columns tool: ${response?.error}`)];
        }
      } else {
        return [createTextContent('No columns selected.')];
      }
    } catch (e) {
      return [createTextContent(`Error executing resize columns tool: ${e}`)];
    }
  },
  [AITool.ResizeRows]: async (args) => {
    try {
      const { sheet_name, selection, size } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      let jsSelection: JsSelection | undefined;
      try {
        jsSelection = sheets.stringToSelection(selection, sheetId);
      } catch (e: any) {
        return [createTextContent(`Error executing resize rows tool. Invalid selection: ${e.message}.`)];
      }

      let rows: Uint32Array;
      try {
        rows = jsSelection.getRowsWithSelectedCells(sheets.jsA1Context);
      } catch (e: any) {
        return [createTextContent(`Error executing resize rows tool. Unable to get selected rows: ${e.message}.`)];
      }

      if (rows.length === 0) {
        return [createTextContent('No rows selected.')];
      }

      const resizing: ColumnRowResize[] = [];
      for (const row of rows) {
        let newSize: number;
        if (size === 'auto') {
          const maxHeight = await content.cellsSheets.getCellsContentMaxHeight(row);
          newSize = Math.max(maxHeight, CELL_HEIGHT);
        } else {
          newSize = CELL_HEIGHT;
        }

        const originalSize = sheets.sheet.offsets.getRowHeight(row);
        if (originalSize !== newSize) {
          resizing.push({ index: row, size: newSize });
        }
      }

      if (resizing.length) {
        // When AI uses size 'auto', set clientResized to false so rows auto-recalculate on font changes
        const clientResized = size !== 'auto';
        const response = await quadraticCore.resizeRows(sheetId, resizing, true, clientResized);
        if (response?.result) {
          return [createTextContent('Resize rows tool executed successfully.')];
        } else {
          return [createTextContent(`Error executing resize rows tool: ${response?.error}`)];
        }
      } else {
        return [createTextContent('No rows selected.')];
      }
    } catch (e) {
      return [createTextContent(`Error executing resize rows tool: ${e}`)];
    }
  },
  [AITool.SetBorders]: async (args) => {
    try {
      const { sheet_name, selection, color, line, border_selection } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      let jsSelection: JsSelection | undefined;
      try {
        jsSelection = sheets.stringToSelection(selection, sheetId);
      } catch (e: any) {
        return [createTextContent(`Invalid selection in SetBorders tool call: ${e.message}.`)];
      }

      // Move AI cursor to the cells getting borders
      try {
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }

      const colorObject = color ? Color(color).rgb().object() : { r: 0, g: 0, b: 0 };
      const style: BorderStyle = {
        line,
        color: { red: colorObject.r, green: colorObject.g, blue: colorObject.b, alpha: 1 },
      };

      const response = await quadraticCore.setBorders(jsSelection.save(), border_selection, style, true);
      if (response?.result) {
        return [createTextContent('Set borders tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing set borders tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing set borders tool: ${e}`)];
    }
  },
  [AITool.MergeCells]: async (args) => {
    try {
      const { sheet_name, selection } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      let jsSelection: JsSelection | undefined;
      try {
        jsSelection = sheets.stringToSelection(selection, sheetId);
      } catch (e: any) {
        return [createTextContent(`Invalid selection in MergeCells tool call: ${e.message}.`)];
      }

      const response = await quadraticCore.mergeCells(jsSelection.save(), true);
      if (response?.result) {
        return [createTextContent('Merge cells tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing merge cells tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing merge cells tool: ${e}`)];
    }
  },
  [AITool.UnmergeCells]: async (args) => {
    try {
      const { sheet_name, selection } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      let jsSelection: JsSelection | undefined;
      try {
        jsSelection = sheets.stringToSelection(selection, sheetId);
      } catch (e: any) {
        return [createTextContent(`Invalid selection in UnmergeCells tool call: ${e.message}.`)];
      }

      const response = await quadraticCore.unmergeCells(jsSelection.save(), true);
      if (response?.result) {
        return [createTextContent('Unmerge cells tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing unmerge cells tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing unmerge cells tool: ${e}`)];
    }
  },
  [AITool.InsertColumns]: async (args) => {
    try {
      const { sheet_name, column, right, count } = args;
      const columnIndex = columnNameToIndex(column);
      if (columnIndex === undefined) {
        return [createTextContent(`Error executing insert columns tool. Invalid column: ${column}.`)];
      }

      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      // the "right" if weird: it's what column we use for formatting, so we need to add 1 if we're inserting to the right
      const response = await quadraticCore.insertColumns(
        sheetId,
        Number(columnIndex) + (right ? 1 : 0),
        count,
        !right,
        true
      );
      if (response?.result) {
        return [createTextContent('Insert columns tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing insert columns tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing insert columns tool: ${e}`)];
    }
  },
  [AITool.InsertRows]: async (args) => {
    try {
      const { sheet_name, row, below, count } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      // the "below" is weird: it's what row we use for formatting, so we need to add 1 if we're inserting below
      const response = await quadraticCore.insertRows(sheetId, row + (below ? 1 : 0), count, !below, true);
      if (response?.result) {
        return [createTextContent('Insert rows tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing insert rows tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing insert rows tool: ${e}`)];
    }
  },
  [AITool.DeleteColumns]: async (args) => {
    try {
      const { sheet_name, columns } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const columnIndicies = columns.flatMap((column) => {
        const columnIndex = columnNameToIndex(column);
        if (columnIndex === undefined) {
          return [];
        }
        return [Number(columnIndex)];
      });
      const response = await quadraticCore.deleteColumns(sheetId, columnIndicies, true);
      if (response?.result) {
        return [createTextContent('Delete columns tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing delete columns tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing delete columns tool: ${e}`)];
    }
  },
  [AITool.DeleteRows]: async (args) => {
    try {
      const { sheet_name, rows } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const response = await quadraticCore.deleteRows(sheetId, rows, true);
      if (response?.result) {
        return [createTextContent('Delete rows tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing delete rows tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing delete rows tool: ${e}`)];
    }
  },
  [AITool.TableMeta]: async (args) => {
    try {
      const {
        sheet_name,
        table_location,
        first_row_is_column_names,
        new_table_name,
        show_name,
        show_columns,
        alternating_row_colors,
      } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sheetRect = sheets.selectionToSheetRect(sheetId, table_location);
      if (first_row_is_column_names !== undefined && first_row_is_column_names !== null) {
        const response = await quadraticCore.dataTableFirstRowAsHeader(
          sheetId,
          Number(sheetRect.min.x),
          Number(sheetRect.min.y),
          first_row_is_column_names,
          true
        );
        if (!response?.result) {
          return [createTextContent(`Error executing table meta tool: ${response?.error}`)];
        }
      }
      if (
        new_table_name !== undefined ||
        new_table_name !== null ||
        show_name !== undefined ||
        show_name !== null ||
        show_columns !== undefined ||
        show_columns !== null ||
        alternating_row_colors !== undefined ||
        alternating_row_colors !== null
      ) {
        const response = await quadraticCore.dataTableMeta(
          sheetId,
          Number(sheetRect.min.x),
          Number(sheetRect.min.y),
          {
            name: new_table_name ?? undefined,
            alternatingColors: alternating_row_colors ?? undefined,
            showName: show_name ?? undefined,
            showColumns: show_columns ?? undefined,
          },
          true
        );
        if (!response?.result) {
          return [createTextContent(`Error executing table meta tool: ${response?.error}`)];
        }
      }
      return [createTextContent('Set table meta tool executed successfully.')];
    } catch (e) {
      return [createTextContent(`Error executing table meta tool: ${e}`)];
    }
  },
  [AITool.TableColumnSettings]: async (args) => {
    try {
      const { sheet_name, table_location, column_names } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sheetRect = sheets.selectionToSheetRect(sheetId, table_location);
      const sheet = content.cellsSheets.getById(sheetId);
      if (!sheet) {
        return [createTextContent(`Error executing table column settings tool. Sheet not found: ${sheet_name}.`)];
      }
      const table = sheet.tables.getTable(sheetRect.min.x, sheetRect.min.y);
      if (!table) {
        return [createTextContent(`Error executing table column settings tool. Table not found at ${table_location}.`)];
      }
      // convert the ai response to the format expected by the core
      const columns: JsDataTableColumnHeader[] = table.codeCell.columns.map((column, i) => {
        const changedColumn = column_names.find((c) => c.old_name.toLowerCase() === column.name.toLowerCase());
        return changedColumn
          ? { valueIndex: i, name: changedColumn.new_name, display: changedColumn.show }
          : { valueIndex: i, name: column.name, display: column.display };
      });
      const response = await quadraticCore.dataTableMeta(
        sheetId,
        Number(sheetRect.min.x),
        Number(sheetRect.min.y),
        { columns },
        true
      );
      if (response?.result) {
        return [createTextContent('Rename table columns tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing rename table columns tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing table column settings tool: ${e}`)];
    }
  },
  [AITool.GetValidations]: async (args) => {
    try {
      const { sheet_name } = args;
      const text = getValidationsToolCall(sheet_name);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing get validations tool: ${e}`)];
    }
  },
  [AITool.AddMessage]: async (args) => {
    try {
      // Move AI cursor to the cells getting validation
      try {
        const sheetId = args.sheet_name
          ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const jsSelection = sheets.stringToSelection(args.selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }
      const text = await addMessageToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add message tool: ${e}`)];
    }
  },
  [AITool.AddLogicalValidation]: async (args) => {
    try {
      // Move AI cursor to the cells getting validation
      try {
        const sheetId = args.sheet_name
          ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const jsSelection = sheets.stringToSelection(args.selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }
      const text = await addLogicalValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add logical validation tool: ${e}`)];
    }
  },
  [AITool.AddListValidation]: async (args) => {
    try {
      // Move AI cursor to the cells getting validation
      try {
        const sheetId = args.sheet_name
          ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const jsSelection = sheets.stringToSelection(args.selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }
      const text = await addListValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add list validation tool: ${e}`)];
    }
  },
  [AITool.AddTextValidation]: async (args) => {
    try {
      // Move AI cursor to the cells getting validation
      try {
        const sheetId = args.sheet_name
          ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const jsSelection = sheets.stringToSelection(args.selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }
      const text = await addTextValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add text validation tool: ${e}`)];
    }
  },
  [AITool.AddNumberValidation]: async (args) => {
    try {
      // Move AI cursor to the cells getting validation
      try {
        const sheetId = args.sheet_name
          ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const jsSelection = sheets.stringToSelection(args.selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }
      const text = await addNumberValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add number validation tool: ${e}`)];
    }
  },
  [AITool.AddDateTimeValidation]: async (args) => {
    try {
      // Move AI cursor to the cells getting validation
      try {
        const sheetId = args.sheet_name
          ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const jsSelection = sheets.stringToSelection(args.selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }
      const text = await addDateTimeValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add date time validation tool: ${e}`)];
    }
  },
  [AITool.RemoveValidations]: async (args) => {
    try {
      // Move AI cursor to the cells having validation removed
      try {
        const sheetId = args.sheet_name
          ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current)
          : sheets.current;
        const jsSelection = sheets.stringToSelection(args.selection, sheetId);
        const selectionString = jsSelection.save();
        aiUser.updateSelection(selectionString, sheetId);
      } catch (e) {
        console.warn('Failed to update AI user selection:', e);
      }
      const text = await removeValidationsToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing remove validations tool: ${e}`)];
    }
  },
  [AITool.GetConditionalFormats]: async (args) => {
    try {
      const text = getConditionalFormatsToolCall(args.sheet_name);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing get conditional formats tool: ${e}`)];
    }
  },
  [AITool.UpdateConditionalFormats]: async (args) => {
    try {
      // Move AI cursor to the first selection if any create/update rules have selections
      const firstRuleWithSelection = args.rules.find(
        (r) => r.selection && (r.action === 'create' || r.action === 'update')
      );
      if (firstRuleWithSelection?.selection) {
        try {
          const sheetId = sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current;
          const jsSelection = sheets.stringToSelection(firstRuleWithSelection.selection, sheetId);
          const selectionString = jsSelection.save();
          aiUser.updateSelection(selectionString, sheetId);
        } catch (e) {
          console.warn('Failed to update AI user selection:', e);
        }
      }
      const text = await updateConditionalFormatsToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing update conditional formats tool: ${e}`)];
    }
  },
  [AITool.GetCodeCellValue]: async (args) => {
    let sheetId: string | undefined;
    let codePos: JsCoordinate | undefined;
    if (args.sheet_name) {
      sheetId = sheets.getSheetIdFromName(args.sheet_name);
    }
    if (!sheetId) {
      sheetId = sheets.current;
    }
    if (args.code_cell_name) {
      try {
        const tableSheetPos: SheetPos = convertTableToSheetPos(args.code_cell_name, sheets.jsA1Context);
        if (tableSheetPos) {
          codePos = { x: Number(tableSheetPos.x), y: Number(tableSheetPos.y) };
          sheetId = tableSheetPos.sheet_id.id;
        }
      } catch (e) {}
    }
    if (!codePos && args.code_cell_position) {
      try {
        const sheetRect: SheetRect = sheets.selectionToSheetRect(sheetId ?? sheets.current, args.code_cell_position);
        codePos = { x: Number(sheetRect.min.x), y: Number(sheetRect.min.y) };
        sheetId = sheetRect.sheet_id.id;
      } catch (e) {}
    }

    if (!codePos || !sheetId) {
      return [
        createTextContent(
          `Error executing get code cell value tool. Invalid code cell position: ${args.code_cell_position} or table name: ${args.code_cell_name}.`
        ),
      ];
    }

    // Move AI cursor to the code cell being read
    try {
      const cellA1 = xyToA1(codePos.x, codePos.y);
      const jsSelection = sheets.stringToSelection(cellA1, sheetId);
      const selectionString = jsSelection.save();
      aiUser.updateSelection(selectionString, sheetId);
    } catch (e) {
      console.warn('Failed to update AI user selection:', e);
    }

    try {
      const text = await codeCellToMarkdown(sheetId, codePos.x, codePos.y);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing get code cell value tool: ${e}`)];
    }
  },
  [AITool.Undo]: async (args) => {
    try {
      const text = await quadraticCore.undo(args.count ?? 1, true);
      return [createTextContent(text ?? 'Undo tool executed successfully.')];
    } catch (e) {
      return [createTextContent(`Error executing undo tool: ${e}`)];
    }
  },
  [AITool.Redo]: async (args) => {
    try {
      const text = await quadraticCore.redo(args.count ?? 1, true);
      return [createTextContent(text ?? 'Redo tool executed successfully.')];
    } catch (e) {
      return [createTextContent(`Error executing redo tool: ${e}`)];
    }
  },
  [AITool.ContactUs]: async (args) => {
    // This tool doesn't perform any action - it just returns content
    // The actual UI interaction (opening feedback modal) is handled in the tool card component
    return [createTextContent('Please use the buttons below to contact our team or start a new chat.')];
  },
  [AITool.OptimizePrompt]: async (args) => {
    return [createTextContent(`Optimized prompt: ${args.optimized_prompt}`)];
  },
} as const;
