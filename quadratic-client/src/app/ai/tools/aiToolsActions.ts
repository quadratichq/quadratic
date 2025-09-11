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
import { defaultFormatUpdate, describeFormatUpdates, expectedEnum } from '@/app/ai/tools/formatUpdate';
import { aiCodeCellSummaryStore } from '@/app/ai/utils/aiCodeCellSummaryStore';
import { AICellResultToMarkdown } from '@/app/ai/utils/aiToMarkdown';
import { codeCellToMarkdown } from '@/app/ai/utils/codeCellToMarkdown';
import { generateCodeCellSummary } from '@/app/ai/utils/generateCodeCellSummary';
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
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { apiClient } from '@/shared/api/apiClient';
import { GET_SCHEMA_TIMEOUT } from '@/shared/constants/connectionsConstant';
import { CELL_HEIGHT, CELL_TEXT_MARGIN_LEFT, CELL_WIDTH, MIN_CELL_WIDTH } from '@/shared/constants/gridConstants';
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

  return [
    createTextContent(`
Executed set code cell value tool successfully.
${
  tableCodeCell.w === 1 && tableCodeCell.h === 1
    ? `Output is ${codeCell.evaluation_result}`
    : `Output size is ${tableCodeCell.w} cells wide and ${tableCodeCell.h} cells high.`
}
`),
  ];
};

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
        });

        ensureRectVisible(sheetId, { x, y }, { x: x + table_data[0].length - 1, y: y + table_data.length - 1 });

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

      if (cell_values.length > 0 && cell_values[0].length > 0) {
        await quadraticCore.setCellValues(sheetId, x, y, cell_values);

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

      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId,
        x,
        y,
        codeString: code_string,
        language: code_cell_language,
        codeCellName: code_cell_name,
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        // After execution, adjust viewport to show full output if it exists
        const tableCodeCell = content.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
        if (tableCodeCell) {
          const width = tableCodeCell.w;
          const height = tableCodeCell.h;
          ensureRectVisible(sheetId, { x, y }, { x: x + width - 1, y: y + height - 1 });
        }

        // Generate and store AI summary for the code cell
        try {
          console.log(
            '[aiToolsActions] Generating AI summary for code cell at:',
            x,
            y,
            'language:',
            code_cell_language
          );
          const summary = await generateCodeCellSummary(code_string, code_cell_language);
          console.log('[aiToolsActions] Generated summary:', summary);
          aiCodeCellSummaryStore.setSummary(sheetId, x, y, summary, code_string);
          console.log('[aiToolsActions] Stored summary in store');
        } catch (error) {
          console.warn('[aiToolsActions] Failed to generate AI summary for code cell:', error);
          // Don't fail the entire operation if summary generation fails
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

    // Import the connection client
    let connectionClient;
    try {
      connectionClient = (await import('@/shared/api/connectionClient')).connectionClient;
    } catch (error) {
      return [
        createTextContent(
          'Error: Unable to retrieve connection client. This could be because of network issues, please try again later.'
        ),
      ];
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
      // Get schemas for each connection
      const schemas = await Promise.all(
        connections.map(async (connection) => {
          try {
            const schema = await connectionClient.schemas.get(
              connection.type,
              connection.uuid,
              teamUuid,
              true,
              GET_SCHEMA_TIMEOUT
            );

            if (!schema) {
              return {
                connectionId: connection.uuid,
                connectionName: connection.name,
                connectionType: connection.type,
                semanticDescription: connection.semanticDescription,
                error: 'No schema data returned from connection service',
              };
            }

            return {
              connectionId: connection.uuid,
              connectionName: connection.name,
              connectionType: connection.type,
              semanticDescription: connection.semanticDescription,
              schema: schema,
            };
          } catch (error) {
            console.warn(`[GetDatabaseSchemas] Failed to get schema for connection ${connection.uuid}:`, error);
            return {
              connectionId: connection.uuid,
              connectionName: connection.name,
              connectionType: connection.type,
              semanticDescription: connection.semanticDescription,
              error: `Failed to retrieve schema: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        })
      );

      // Filter out null results
      if (schemas.length === 0) {
        return [
          createTextContent(
            'No database schemas could be retrieved. All connections may be unavailable or have configuration issues.'
          ),
        ];
      }

      // Format the response
      const schemaText = schemas
        .map((item) => {
          if ('error' in item) {
            return `Connection: ${item.connectionName} (${item.connectionType})\nID: ${item.connectionId}\nError: ${item.error}\n`;
          }

          const tablesInfo =
            item.schema?.tables
              ?.map((table: any) => {
                const columnsInfo =
                  table.columns
                    ?.map((col: any) => `  - ${col.name}: ${col.type}${col.is_nullable ? ' (nullable)' : ''}`)
                    .join('\n') || '  No columns found';
                return `Table: ${table.name} (Schema: ${table.schema || 'public'})\n${columnsInfo}`;
              })
              .join('\n\n') || 'No tables found';

          return `Connection: ${item.connectionName} (${item.connectionType})\nID: ${item.connectionId}\nDatabase: ${item.schema?.database || 'Unknown'}\n\n${tablesInfo}\n`;
        })
        .filter(Boolean)
        .join('\n---\n\n');

      // Add connection summary for future reference
      const connectionSummary = schemas
        .filter((item) => item && !('error' in item))
        .map((item) => `- ${item!.connectionName} (${item!.connectionType}): ${item!.connectionId}`)
        .join('\n');

      const summaryText = connectionSummary
        ? `\n\nAvailable connection IDs for future reference:\n${connectionSummary}`
        : '';

      return [
        createTextContent(
          schemaText
            ? `Database schemas retrieved successfully:\n\n${schemaText}${summaryText}`
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
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        // After execution, adjust viewport to show full output if it exists
        const tableCodeCell = content.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
        if (tableCodeCell) {
          const width = tableCodeCell.w;
          const height = tableCodeCell.h;
          ensureRectVisible(sheetId, { x, y }, { x: x + width - 1, y: y + height - 1 });
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
  [AITool.SetFormulaCellValue]: async (args, messageMetaData) => {
    try {
      let { sheet_name, code_cell_position, formula_string } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(code_cell_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid formula cell position, this should be a single cell, not a range')];
      }
      const { x, y } = selection.getCursor();

      if (formula_string.startsWith('=')) {
        formula_string = formula_string.slice(1);
      }

      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId,
        x,
        y,
        codeString: formula_string,
        language: 'Formula',
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        // After execution, adjust viewport to show full output if it exists
        const tableCodeCell = content.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
        if (tableCodeCell) {
          const width = tableCodeCell.w;
          const height = tableCodeCell.h;
          ensureRectVisible(sheetId, { x, y }, { x: x + width - 1, y: y + height - 1 });
        }

        const result = await setCodeCellResult(sheetId, x, y, messageMetaData);
        return result;
      } else {
        return [createTextContent('Error executing set formula cell value tool')];
      }
    } catch (e) {
      return [createTextContent(`Error executing set formula cell value tool: ${e}`)];
    }
  },
  [AITool.MoveCells]: async (args) => {
    try {
      const { sheet_name, source_selection_rect, target_top_left_position } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sourceSelection = sheets.stringToSelection(source_selection_rect, sheetId);
      const sourceRect = sourceSelection.getSingleRectangleOrCursor(sheets.jsA1Context);
      if (!sourceRect) {
        return [createTextContent('Invalid source selection, this should be a single rectangle, not a range')];
      }
      const sheetRect: SheetRect = {
        min: {
          x: sourceRect.min.x,
          y: sourceRect.min.y,
        },
        max: {
          x: sourceRect.max.x,
          y: sourceRect.max.y,
        },
        sheet_id: {
          id: sheetId,
        },
      };

      const targetSelection = sheets.stringToSelection(target_top_left_position, sheetId);
      if (!targetSelection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }
      const { x, y } = targetSelection.getCursor();

      await quadraticCore.moveCells(sheetRect, x, y, sheetId, false, false);

      return [createTextContent('Executed move cells tool successfully.')];
    } catch (e) {
      return [createTextContent(`Error executing move cells tool: ${e}`)];
    }
  },
  [AITool.DeleteCells]: async (args) => {
    try {
      const { sheet_name, selection } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sourceSelection = sheets.stringToSelection(selection, sheetId);

      const response = await quadraticCore.deleteCellValues(sourceSelection.save());
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
  [AITool.PDFImport]: async () => {
    return [createTextContent('PDF import tool executed successfully.')];
  },
  [AITool.GetCellData]: async (args) => {
    try {
      const { selection, sheet_name, page } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
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
      const kind = args.number_type
        ? expectedEnum<NumericFormatKind>(args.number_type, ['NUMBER', 'CURRENCY', 'PERCENTAGE', 'EXPONENTIAL'])
        : null;
      let numericFormat: NumericFormat | null = null;
      if (kind) {
        numericFormat = args.number_type
          ? {
              type: kind,
              symbol: args.currency_symbol ?? null,
            }
          : null;
      }
      const formatUpdates: FormatUpdate = {
        ...defaultFormatUpdate(),
        bold: args.bold ?? null,
        italic: args.italic ?? null,
        underline: args.underline ?? null,
        strike_through: args.strike_through ?? null,
        text_color: args.text_color ?? null,
        fill_color: args.fill_color ?? null,
        align: args.align ? expectedEnum<CellAlign>(args.align, ['left', 'center', 'right']) : null,
        vertical_align: args.vertical_align
          ? expectedEnum<CellVerticalAlign>(args.vertical_align, ['top', 'middle', 'bottom'])
          : null,
        wrap: args.wrap ? expectedEnum<CellWrap>(args.wrap, ['wrap', 'overflow', 'clip']) : null,
        numeric_commas: args.numeric_commas ?? null,
        numeric_format: numericFormat,
        date_time: args.date_time ?? null,
      };

      const sheetId = args.sheet_name ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current) : sheets.current;
      const response = await quadraticCore.setFormats(sheetId, args.selection, formatUpdates);
      if (response?.result) {
        return [
          createTextContent(
            `Executed set formats tool on ${args.selection} for ${describeFormatUpdates(formatUpdates, args)} successfully.`
          ),
        ];
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
      const response = await quadraticCore.gridToDataTable(sheetRect, args.table_name, args.first_row_is_column_names);
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
      const response = await quadraticCore.addSheet(sheet_name, insert_before_sheet_name ?? undefined);
      if (response?.result) {
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
      const response = await quadraticCore.duplicateSheet(sheetId, name_of_new_sheet);
      if (response?.result) {
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
      const response = await quadraticCore.setSheetName(sheetId, new_name);
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
      const response = await quadraticCore.deleteSheet(sheetId);
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
      const response = await quadraticCore.moveSheet(sheetId, insertBeforeSheetId);
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
      const response = await quadraticCore.setSheetsColor(sheet_names_to_color);
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
      const response = await quadraticCore.rerunCodeCells(sheetId, selection ?? undefined);
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
        const response = await quadraticCore.resizeColumns(sheetId, resizing);
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
        const response = await quadraticCore.resizeRows(sheetId, resizing);
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

      const colorObject = color ? Color(color).rgb().object() : { r: 0, g: 0, b: 0 };
      const style: BorderStyle = {
        line,
        color: { red: colorObject.r, green: colorObject.g, blue: colorObject.b, alpha: 1 },
      };

      const response = await quadraticCore.setBorders(jsSelection.save(), border_selection, style);
      if (response?.result) {
        return [createTextContent('Set borders tool executed successfully.')];
      } else {
        return [createTextContent(`Error executing set borders tool: ${response?.error}`)];
      }
    } catch (e) {
      return [createTextContent(`Error executing set borders tool: ${e}`)];
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
      const response = await quadraticCore.insertColumns(sheetId, Number(columnIndex) + (right ? 1 : 0), count, !right);
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
      const response = await quadraticCore.insertRows(sheetId, row + (below ? 1 : 0), count, !below);
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
      const response = await quadraticCore.deleteColumns(sheetId, columnIndicies);
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
      const response = await quadraticCore.deleteRows(sheetId, rows);
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
          first_row_is_column_names
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
        const response = await quadraticCore.dataTableMeta(sheetId, Number(sheetRect.min.x), Number(sheetRect.min.y), {
          name: new_table_name ?? undefined,
          alternatingColors: alternating_row_colors ?? undefined,
          showName: show_name ?? undefined,
          showColumns: show_columns ?? undefined,
        });
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
      const response = await quadraticCore.dataTableMeta(sheetId, Number(sheetRect.min.x), Number(sheetRect.min.y), {
        columns,
      });
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
      const text = await addMessageToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add message tool: ${e}`)];
    }
  },
  [AITool.AddLogicalValidation]: async (args) => {
    try {
      const text = await addLogicalValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add logical validation tool: ${e}`)];
    }
  },
  [AITool.AddListValidation]: async (args) => {
    try {
      const text = await addListValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add list validation tool: ${e}`)];
    }
  },
  [AITool.AddTextValidation]: async (args) => {
    try {
      const text = await addTextValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add text validation tool: ${e}`)];
    }
  },
  [AITool.AddNumberValidation]: async (args) => {
    try {
      const text = await addNumberValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add number validation tool: ${e}`)];
    }
  },
  [AITool.AddDateTimeValidation]: async (args) => {
    try {
      const text = await addDateTimeValidationToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing add date time validation tool: ${e}`)];
    }
  },
  [AITool.RemoveValidations]: async (args) => {
    try {
      const text = await removeValidationsToolCall(args);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing remove validations tool: ${e}`)];
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
    try {
      const text = await codeCellToMarkdown(sheetId, codePos.x, codePos.y);
      return [createTextContent(text)];
    } catch (e) {
      return [createTextContent(`Error executing get code cell value tool: ${e}`)];
    }
  },
} as const;
