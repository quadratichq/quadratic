import { defaultFormatUpdate, describeFormatUpdates, expectedEnum } from '@/app/ai/tools/formatUpdate';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type {
  CellAlign,
  CellVerticalAlign,
  CellWrap,
  FormatUpdate,
  NumericFormat,
  NumericFormatKind,
  SheetRect,
} from '@/app/quadratic-core-types';
import { selectionToSheetRect, stringToSelection } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { apiClient } from '@/shared/api/apiClient';
import { dataUrlToMimeTypeAndData, isSupportedImageMimeType } from 'quadratic-shared/ai/helpers/files.helper';
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
      events.once('transactionEnd', (transactionEnd) => {
        if (transactionEnd.transactionId === transactionId) {
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
  const table = pixiApp.cellsSheets.getById(sheetId)?.tables.getTableFromTableCell(x, y);
  const codeCell = await quadraticCore.getCodeCell(sheetId, x, y);
  if (!table || !codeCell) {
    return [
      {
        type: 'text',
        text: 'Error executing set code cell value tool',
      },
    ];
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
      {
        type: 'text',
        text: `
The code cell run has resulted in an error:
\`\`\`
${codeCell.std_err}
\`\`\`
Think and reason about the error and try to fix it.
`,
      },
    ];
  }

  if (codeCell.spill_error) {
    return [
      {
        type: 'text',
        text: `
The code cell has spilled, because the output overlaps with existing data on the sheet at position:
\`\`\`json\n
${JSON.stringify(codeCell.spill_error?.map((p) => ({ x: Number(p.x), y: Number(p.y) })))}
\`\`\`
Output size is ${table.codeCell.w} cells wide and ${table.codeCell.h} cells high.
Move the code cell to a new position to avoid spilling. Make sure the new position is not overlapping with existing data on the sheet.
`,
      },
    ];
  }

  if (table.codeCell.is_html) {
    const htmlCell = htmlCellsHandler.findCodeCell(sheetId, x, y);
    const dataUrl = (await htmlCell?.getImageDataUrl()) ?? '';
    if (dataUrl) {
      const { mimeType, data } = dataUrlToMimeTypeAndData(dataUrl);
      if (isSupportedImageMimeType(mimeType) && !!data) {
        return [
          {
            type: 'data',
            data,
            mimeType,
            fileName: table.codeCell.name,
          },
          {
            type: 'text',
            text: 'Executed set code cell value tool successfully to create a plotly chart.',
          },
        ];
      }
    }
  } else if (table.codeCell.is_html_image) {
    const image = pixiApp.cellsSheets.getById(sheetId)?.cellsImages.findCodeCell(x, y);
    if (image?.dataUrl) {
      const { mimeType, data } = dataUrlToMimeTypeAndData(image.dataUrl);
      if (isSupportedImageMimeType(mimeType) && !!data) {
        return [
          {
            type: 'data',
            data,
            mimeType,
            fileName: table.codeCell.name,
          },
          {
            type: 'text',
            text: 'Executed set code cell value tool successfully to create a javascript chart.',
          },
        ];
      }
    }
  }

  return [
    {
      type: 'text',
      text: `
Executed set code cell value tool successfully.
${
  table.isSingleValue()
    ? `Output is ${codeCell.evaluation_result}`
    : `Output size is ${table.codeCell.w} cells wide and ${table.codeCell.h} cells high.`
}
`,
    },
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
    return [{ type: 'text', text: `Executed set ai model tool successfully with name: ${args.ai_model}` }];
  },
  [AITool.SetChatName]: async (args) => {
    // no action as this tool is only meant to get structured data from AI
    return [{ type: 'text', text: `Executed set chat name tool successfully with name: ${args.chat_name}` }];
  },
  [AITool.AddDataTable]: async (args) => {
    const { sheet_name, top_left_position, table_name, table_data } = args;
    try {
      const sheetId = sheets.getSheetByName(sheet_name)?.id ?? sheets.current;
      const selection = stringToSelection(top_left_position, sheetId, sheets.a1Context);
      if (!selection.isSingleSelection()) {
        return [{ type: 'text', text: 'Invalid code cell position, this should be a single cell, not a range' }];
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
          cursor: sheets.getCursorPosition(),
        });

        ensureRectVisible(sheetId, { x, y }, { x: x + table_data[0].length - 1, y: y + table_data.length - 1 });

        return [{ type: 'text', text: `Executed add data table tool successfully with name: ${table_name}` }];
      } else {
        return [{ type: 'text', text: 'data_table values are empty, cannot add data table without values' }];
      }
    } catch (e) {
      return [{ type: 'text', text: `Error executing set cell values tool: ${e}` }];
    }
  },
  [AITool.SetCellValues]: async (args) => {
    const { sheet_name, top_left_position, cell_values } = args;
    try {
      const sheetId = sheets.getSheetByName(sheet_name)?.id ?? sheets.current;
      const selection = stringToSelection(top_left_position, sheetId, sheets.a1Context);
      if (!selection.isSingleSelection()) {
        return [{ type: 'text', text: 'Invalid code cell position, this should be a single cell, not a range' }];
      }
      const { x, y } = selection.getCursor();

      if (cell_values.length > 0 && cell_values[0].length > 0) {
        await quadraticCore.setCellValues(sheetId, x, y, cell_values, sheets.getCursorPosition());

        ensureRectVisible(sheetId, { x, y }, { x: x + cell_values[0].length - 1, y: y + cell_values.length - 1 });

        return [{ type: 'text', text: 'Executed set cell values tool successfully' }];
      } else {
        return [{ type: 'text', text: 'cell_values are empty, cannot set cell values without values' }];
      }
    } catch (e) {
      return [{ type: 'text', text: `Error executing set cell values tool: ${e}` }];
    }
  },
  [AITool.SetCodeCellValue]: async (args, messageMetaData) => {
    let { sheet_name, code_cell_language, code_string, code_cell_position, code_cell_name } = args;
    try {
      const sheetId = sheets.getSheetByName(sheet_name)?.id ?? sheets.current;
      const selection = stringToSelection(code_cell_position, sheetId, sheets.a1Context);
      if (!selection.isSingleSelection()) {
        return [{ type: 'text', text: 'Invalid code cell position, this should be a single cell, not a range' }];
      }
      const { x, y } = selection.getCursor();

      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId,
        x,
        y,
        codeString: code_string,
        language: code_cell_language,
        codeCellName: code_cell_name,
        cursor: sheets.getCursorPosition(),
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        // After execution, adjust viewport to show full output if it exists
        const table = pixiApp.cellsSheets.getById(sheetId)?.tables.getTableFromTableCell(x, y);
        if (table) {
          const width = table.codeCell.w;
          const height = table.codeCell.h;
          ensureRectVisible(sheetId, { x, y }, { x: x + width - 1, y: y + height - 1 });
        }

        const result = await setCodeCellResult(sheetId, x, y, messageMetaData);
        return result;
      } else {
        return [{ type: 'text', text: 'Error executing set code cell value tool' }];
      }
    } catch (e) {
      return [{ type: 'text', text: `Error executing set code cell value tool: ${e}` }];
    }
  },
  [AITool.SetFormulaCellValue]: async (args, messageMetaData) => {
    let { sheet_name, formula_string, code_cell_position } = args;
    try {
      const sheetId = sheets.getSheetByName(sheet_name)?.id ?? sheets.current;
      const selection = stringToSelection(code_cell_position, sheetId, sheets.a1Context);
      if (!selection.isSingleSelection()) {
        return [{ type: 'text', text: 'Invalid formula cell position, this should be a single cell, not a range' }];
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
        cursor: sheets.getCursorPosition(),
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        // After execution, adjust viewport to show full output if it exists
        const table = pixiApp.cellsSheets.getById(sheetId)?.tables.getTableFromTableCell(x, y);
        if (table) {
          const width = table.codeCell.w;
          const height = table.codeCell.h;
          ensureRectVisible(sheetId, { x, y }, { x: x + width - 1, y: y + height - 1 });
        }

        const result = await setCodeCellResult(sheetId, x, y, messageMetaData);
        return result;
      } else {
        return [{ type: 'text', text: 'Error executing set formula cell value tool' }];
      }
    } catch (e) {
      return [{ type: 'text', text: `Error executing set formula cell value tool: ${e}` }];
    }
  },
  [AITool.MoveCells]: async (args) => {
    const { sheet_name, source_selection_rect, target_top_left_position } = args;
    try {
      const sheetId = sheets.getSheetByName(sheet_name)?.id ?? sheets.current;
      const sourceSelection = stringToSelection(source_selection_rect, sheetId, sheets.a1Context);
      const sourceRect = sourceSelection.getSingleRectangleOrCursor();
      if (!sourceRect) {
        return [{ type: 'text', text: 'Invalid source selection, this should be a single rectangle, not a range' }];
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

      const targetSelection = stringToSelection(target_top_left_position, sheetId, sheets.a1Context);
      if (!targetSelection.isSingleSelection()) {
        return [{ type: 'text', text: 'Invalid code cell position, this should be a single cell, not a range' }];
      }
      const { x, y } = targetSelection.getCursor();

      await quadraticCore.moveCells(sheetRect, x, y, sheetId, false, false);

      return [{ type: 'text', text: 'Executed move cells tool successfully.' }];
    } catch (e) {
      return [{ type: 'text', text: `Error executing move cells tool: ${e}` }];
    }
  },
  [AITool.DeleteCells]: async (args) => {
    const { sheet_name, selection } = args;
    const sheetId = sheets.getSheetByName(sheet_name)?.id ?? sheets.current;
    try {
      const sourceSelection = stringToSelection(selection, sheetId, sheets.a1Context);

      await quadraticCore.deleteCellValues(sourceSelection.save(), sheets.getCursorPosition());

      return [{ type: 'text', text: 'Executed delete cells tool successfully.' }];
    } catch (e) {
      return [{ type: 'text', text: `Error executing delete cells tool: ${e}` }];
    }
  },
  [AITool.UpdateCodeCell]: async (args, messageMetaData) => {
    const { code_string } = args;
    try {
      if (!pixiAppSettings.setCodeEditorState) {
        throw new Error('setCodeEditorState is not defined');
      }

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
        cursor: sheets.getCursorPosition(),
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        const result = await setCodeCellResult(codeCell.sheetId, codeCell.pos.x, codeCell.pos.y, messageMetaData);

        return [
          ...result,
          {
            type: 'text',
            text: 'User is presented with diff editor, with accept and reject buttons, to revert the changes if needed',
          },
        ];
      } else {
        return [
          {
            type: 'text',
            text: 'Error executing update code cell tool',
          },
        ];
      }
    } catch (e) {
      return [
        {
          type: 'text',
          text: `Error executing update code cell tool: ${e}`,
        },
      ];
    }
  },
  [AITool.CodeEditorCompletions]: async () => {
    return [
      {
        type: 'text',
        text: 'Code editor completions tool executed successfully, user is presented with a list of code completions, to choose from.',
      },
    ];
  },
  [AITool.UserPromptSuggestions]: async () => {
    return [
      {
        type: 'text',
        text: 'User prompt suggestions tool executed successfully, user is presented with a list of prompt suggestions, to choose from.',
      },
    ];
  },
  [AITool.PDFImport]: async () => {
    return [
      {
        type: 'text',
        text: 'PDF import tool executed successfully.',
      },
    ];
  },
  [AITool.GetCellData]: async (args) => {
    const { selection, sheet_name, page } = args;
    try {
      const sheetId = sheets.getSheetIdFromName(sheet_name);
      const response = await quadraticCore.getAICells(selection, sheetId, page);
      if (response) {
        return [
          {
            type: 'text',
            text: response,
          },
        ];
      } else {
        return [
          {
            type: 'text',
            text: 'There was an error executing the get cells tool',
          },
        ];
      }
    } catch (e) {
      return [
        {
          type: 'text',
          text: `Error executing get cell data tool: ${e}`,
        },
      ];
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
        align: expectedEnum<CellAlign>(args.align, ['left', 'center', 'right']),
        vertical_align: expectedEnum<CellVerticalAlign>(args.vertical_align, ['top', 'middle', 'bottom']),
        wrap: expectedEnum<CellWrap>(args.wrap, ['wrap', 'overflow', 'clip']),
        numeric_commas: args.numeric_commas ?? null,
        numeric_format: numericFormat,
        date_time: args.date_time ?? null,
      };

      const sheetId = sheets.getSheetIdFromName(args.sheet_name);
      await quadraticCore.setFormats(sheetId, args.selection, formatUpdates);
      return [
        {
          type: 'text',
          text: `Executed set formats tool on ${args.selection} for ${describeFormatUpdates(formatUpdates, args)} successfully.`,
        },
      ];
    } catch (e) {
      return [
        {
          type: 'text',
          text: `Error executing set formats tool: ${e}`,
        },
      ];
    }
  },
  [AITool.GetTextFormats]: async (args) => {
    try {
      const sheetId = sheets.getSheetIdFromName(args.sheet_name);
      const response = await quadraticCore.getAICellFormats(sheetId, args.selection, args.page);
      if (response) {
        return [
          {
            type: 'text',
            text: `The selection ${args.selection} has:\n${response}`,
          },
        ];
      } else {
        return [
          {
            type: 'text',
            text: 'There was an error executing the get cell formats tool',
          },
        ];
      }
    } catch (e) {
      return [
        {
          type: 'text',
          text: `Error executing get text formats tool: ${e}`,
        },
      ];
    }
  },
  [AITool.ConvertToTable]: async (args) => {
    try {
      const sheetId = sheets.getSheetIdFromName(args.sheet_name);
      const sheetRect = selectionToSheetRect(sheetId, args.selection, sheets.a1Context);
      if (sheetRect) {
        const response = await quadraticCore.gridToDataTable(
          sheetRect,
          args.table_name,
          args.first_row_is_column_names,
          sheets.getCursorPosition()
        );
        if (response) {
          return [
            {
              type: 'text',
              text: 'Converted sheet data to table.',
            },
          ];
        } else {
          return [
            {
              type: 'text',
              text: 'Error executing convert to table tool',
            },
          ];
        }
      } else {
        return [
          {
            type: 'text',
            text: 'Invalid selection, this should be a single rectangle, not a range',
          },
        ];
      }
    } catch (e) {
      return [
        {
          type: 'text',
          text: `Error executing convert to table tool: ${e}`,
        },
      ];
    }
  },
  [AITool.GetDatabaseSchemas]: async (args, messageMetaData) => {
    try {
      const { connection_ids } = args;

      // Get team UUID from the current context
      const teamUuid = pixiAppSettings.editorInteractionState.teamUuid;
      if (!teamUuid) {
        return [
          {
            type: 'text',
            text: 'Error: No team context available to retrieve database schemas. Make sure you are working within a team context.',
          },
        ];
      }

      // Import the connection client
      const { connectionClient } = await import('@/shared/api/connectionClient');

      // Get all team connections or specific ones
      let connections;
      try {
        if (connection_ids && connection_ids.length > 0) {
          // Validate connection IDs - they should be UUIDs
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const invalidIds = connection_ids.filter((id) => !uuidRegex.test(id));

          if (invalidIds.length > 0) {
            return [
              {
                type: 'text',
                text: `Error: Invalid connection IDs provided: ${invalidIds.join(', ')}. Connection IDs must be valid UUIDs. To get all available connections, call this tool without the connection_ids parameter.`,
              },
            ];
          }

          // Get specific connections
          connections = await Promise.all(
            connection_ids.map(async (id) => {
              try {
                return await apiClient.connections.get({ connectionUuid: id, teamUuid });
              } catch (error) {
                console.warn(`[GetDatabaseSchemas] Failed to get connection ${id}:`, error);
                return null;
              }
            })
          );
          connections = connections.filter(Boolean);

          if (connections.length === 0) {
            return [
              {
                type: 'text',
                text: `Error: None of the specified connection IDs were found or accessible. Make sure the connection IDs are correct and that you have access to them. To see all available connections, call this tool without the connection_ids parameter.`,
              },
            ];
          }
        } else {
          // Get all team connections
          connections = await apiClient.connections.list(teamUuid);
        }
      } catch (connectionError) {
        console.error('[GetDatabaseSchemas] Failed to fetch team connections:', connectionError);
        return [
          {
            type: 'text',
            text: 'Error: Unable to retrieve database connections. This could be because:\n\n1. The Quadratic API server is not running (check if localhost:8000 is accessible)\n2. The connection service is unavailable\n3. Network connectivity issues\n\nIn development, make sure to run `npm start` or `npm run docker:base` to start all required services.',
          },
        ];
      }

      if (!connections || connections.length === 0) {
        return [
          {
            type: 'text',
            text: 'No database connections found for this team. Please set up database connections in the team settings first.',
          },
        ];
      }

      // Get schemas for each connection
      const schemas = await Promise.all(
        connections.map(async (connection) => {
          if (!connection) return null;
          try {
            const connectionType = connection.type.toLowerCase() as 'postgres' | 'mysql' | 'mssql' | 'snowflake';
            const schema = await connectionClient.schemas.get(connectionType, connection.uuid, teamUuid);

            if (!schema) {
              return {
                connectionId: connection.uuid,
                connectionName: connection.name,
                connectionType: connection.type,
                error: 'No schema data returned from connection service',
              };
            }

            return {
              connectionId: connection.uuid,
              connectionName: connection.name,
              connectionType: connection.type,
              schema: schema,
            };
          } catch (error) {
            console.warn(`[GetDatabaseSchemas] Failed to get schema for connection ${connection.uuid}:`, error);
            return {
              connectionId: connection.uuid,
              connectionName: connection.name,
              connectionType: connection.type,
              error: `Failed to retrieve schema: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        })
      );

      // Filter out null results
      const validSchemas = schemas.filter(Boolean);

      if (validSchemas.length === 0) {
        return [
          {
            type: 'text',
            text: 'No database schemas could be retrieved. All connections may be unavailable or have configuration issues.',
          },
        ];
      }

      // Format the response
      const schemaText = validSchemas
        .map((item) => {
          if (!item) return '';
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
      const connectionSummary = validSchemas
        .filter((item) => item && !('error' in item))
        .map((item) => `- ${item!.connectionName} (${item!.connectionType}): ${item!.connectionId}`)
        .join('\n');

      const summaryText = connectionSummary
        ? `\n\nAvailable connection IDs for future reference:\n${connectionSummary}`
        : '';

      return [
        {
          type: 'text',
          text: schemaText
            ? `Database schemas retrieved successfully:\n\n${schemaText}${summaryText}`
            : `No database schema information available.${summaryText}`,
        },
      ];
    } catch (error) {
      console.error('[GetDatabaseSchemas] Unexpected error:', error);
      return [
        {
          type: 'text',
          text: `Error retrieving database schemas: ${error instanceof Error ? error.message : String(error)}`,
        },
      ];
    }
  },
} as const;
