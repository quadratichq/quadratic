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
  CodeCellLanguage,
  FormatUpdate,
  NumericFormat,
  NumericFormatKind,
  SheetRect,
} from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { apiClient } from '@/shared/api/apiClient';
import { dataUrlToMimeTypeAndData, isSupportedImageMimeType } from 'quadratic-shared/ai/helpers/files.helper';
import type { AIToolsArgsSchema, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AISource, ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import type { z } from 'zod';

export function convertArgsToCodeCellLanguage(
  code_cell_language: z.infer<(typeof aiToolsSpec)[AITool.SetCodeCellValue]['responseSchema']>['code_cell_language'],
  connection_id: z.infer<(typeof aiToolsSpec)[AITool.SetCodeCellValue]['responseSchema']>['connection_id']
): CodeCellLanguage {
  if (code_cell_language === 'Python' || code_cell_language === 'Javascript') {
    return code_cell_language;
  }

  return { Connection: { kind: code_cell_language, id: connection_id ?? '' } };
}

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
  const tableCodeCell = pixiApp.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
  const codeCell = tableCodeCell
    ? await quadraticCore.getCodeCell(sheetId, tableCodeCell.x, tableCodeCell.y)
    : undefined;
  if (!tableCodeCell || !codeCell) {
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
Output size is ${tableCodeCell.w} cells wide and ${tableCodeCell.h} cells high.
Move the code cell to a new position to avoid spilling. Make sure the new position is not overlapping with existing data on the sheet.
`,
      },
    ];
  }

  if (tableCodeCell.is_html) {
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
            fileName: tableCodeCell.name,
          },
          {
            type: 'text',
            text: 'Executed set code cell value tool successfully to create a plotly chart.',
          },
        ];
      }
    }
  } else if (tableCodeCell.is_html_image) {
    const image = pixiApp.cellsSheets.getById(sheetId)?.cellsImages.findCodeCell(x, y);
    if (image?.dataUrl) {
      const { mimeType, data } = dataUrlToMimeTypeAndData(image.dataUrl);
      if (isSupportedImageMimeType(mimeType) && !!data) {
        return [
          {
            type: 'data',
            data,
            mimeType,
            fileName: tableCodeCell.name,
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
  tableCodeCell.w === 1 && tableCodeCell.h === 1
    ? `Output is ${codeCell.evaluation_result}`
    : `Output size is ${tableCodeCell.w} cells wide and ${tableCodeCell.h} cells high.`
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
    try {
      const { sheet_name, top_left_position, table_name, table_data } = args;
      const sheetId = sheets.getSheetByName(sheet_name)?.id ?? sheets.current;
      const selection = sheets.stringToSelection(top_left_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
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
    try {
      const { sheet_name, top_left_position, cell_values } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(top_left_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
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
    try {
      let { sheet_name, code_cell_name, code_cell_language, code_string, code_cell_position, connection_id } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(code_cell_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [{ type: 'text', text: 'Invalid code cell position, this should be a single cell, not a range' }];
      }

      const language = convertArgsToCodeCellLanguage(code_cell_language, connection_id);
      if (typeof language === 'object' && !connection_id) {
        return [{ type: 'text', text: 'No connection id provided, this is required for SQL connections' }];
      }

      const { x, y } = selection.getCursor();

      const transactionId = await quadraticCore.setCodeCellValue({
        sheetId,
        x,
        y,
        codeString: code_string,
        language,
        codeCellName: code_cell_name,
        cursor: sheets.getCursorPosition(),
      });

      if (transactionId) {
        await waitForSetCodeCellValue(transactionId);

        // After execution, adjust viewport to show full output if it exists
        const tableCodeCell = pixiApp.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
        if (tableCodeCell) {
          const width = tableCodeCell.w;
          const height = tableCodeCell.h;
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
    try {
      let { sheet_name, formula_string, code_cell_position } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(code_cell_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
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
        const tableCodeCell = pixiApp.cellsSheets.getById(sheetId)?.tables.getCodeCellIntersects({ x, y });
        if (tableCodeCell) {
          const width = tableCodeCell.w;
          const height = tableCodeCell.h;
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
    try {
      const { sheet_name, source_selection_rect, target_top_left_position } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sourceSelection = sheets.stringToSelection(source_selection_rect, sheetId);
      const sourceRect = sourceSelection.getSingleRectangleOrCursor(sheets.jsA1Context);
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

      const targetSelection = sheets.stringToSelection(target_top_left_position, sheetId);
      if (!targetSelection.isSingleSelection(sheets.jsA1Context)) {
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
    try {
      const { sheet_name, selection } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const sourceSelection = sheets.stringToSelection(selection, sheetId);

      const response = await quadraticCore.deleteCellValues(sourceSelection.save(), sheets.getCursorPosition());
      if (response?.result) {
        return [
          {
            type: 'text',
            text: `The selection ${args.selection} was deleted successfully.`,
          },
        ];
      } else {
        return [
          {
            type: 'text',
            text: 'There was an error executing the delete cells tool',
          },
        ];
      }
    } catch (e) {
      return [{ type: 'text', text: `Error executing delete cells tool: ${e}` }];
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
    try {
      const { selection, sheet_name, page } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const response = await quadraticCore.getAICells(selection, sheetId, page);
      if (typeof response === 'string') {
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
            text: `There was an error executing the get cells tool ${response?.error}`,
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
          {
            type: 'text',
            text: `Executed set formats tool on ${args.selection} for ${describeFormatUpdates(formatUpdates, args)} successfully.`,
          },
        ];
      } else {
        return [
          {
            type: 'text',
            text: response?.error ?? 'There was an error executing the set formats tool',
          },
        ];
      }
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
      const sheetId = args.sheet_name ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current) : sheets.current;
      const response = await quadraticCore.getAICellFormats(sheetId, args.selection, args.page);
      if (typeof response === 'string') {
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
            text: `There was an error executing the get cell formats tool ${response?.error}`,
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
      const sheetId = args.sheet_name ? (sheets.getSheetByName(args.sheet_name)?.id ?? sheets.current) : sheets.current;
      const sheetRect = sheets.selectionToSheetRect(sheetId, args.selection);
      if (sheetRect) {
        const response = await quadraticCore.gridToDataTable(
          sheetRect,
          args.table_name,
          args.first_row_is_column_names,
          sheets.getCursorPosition()
        );
        if (response?.result) {
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
              text: response?.error ?? 'Error executing convert to table tool',
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
  [AITool.WebSearch]: async (args) => {
    return [
      {
        type: 'text',
        text: 'Search tool executed successfully.',
      },
    ];
  },
  [AITool.WebSearchInternal]: async (args) => {
    return [
      {
        type: 'text',
        text: 'Web search tool executed successfully.',
      },
    ];
  },
  [AITool.GetDatabaseSchemas]: async (args) => {
    const { connection_ids } = args;
    const connectionIds = connection_ids.filter((id) => !!id);

    // Get team UUID from the current context
    const teamUuid = pixiAppSettings.editorInteractionState.teamUuid;
    if (!teamUuid) {
      return [
        {
          type: 'text',
          text: 'Unable to retrieve database schemas. Access to team is required.',
        },
      ];
    }

    // Import the connection client
    let connectionClient;
    try {
      connectionClient = (await import('@/shared/api/connectionClient')).connectionClient;
    } catch (error) {
      return [
        {
          type: 'text',
          text: 'Error: Unable to retrieve connection client. This could be because of network issues, please try again later.',
        },
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
          {
            type: 'text',
            text: `Error: ${connectionIds.length === 0 ? 'No database connections found for this team. Please set up database connections in the team settings first.' : 'None of the specified connection IDs were found or accessible. Make sure the connection IDs are correct. To see all available connections, call this tool with empty connection_ids array.'}`,
          },
        ];
      }
    } catch (connectionError) {
      console.warn('[GetDatabaseSchemas] Failed to fetch team connections:', connectionError);
      return [
        {
          type: 'text',
          text: `Error: Unable to retrieve database connections. This could be because of network issues, please try again later. ${connectionError}`,
        },
      ];
    }

    try {
      // Get schemas for each connection
      const schemas = await Promise.all(
        connections.map(async (connection) => {
          try {
            const schema = await connectionClient.schemas.get(connection.type, connection.uuid, teamUuid);

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
      if (schemas.length === 0) {
        return [
          {
            type: 'text',
            text: 'No database schemas could be retrieved. All connections may be unavailable or have configuration issues.',
          },
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
