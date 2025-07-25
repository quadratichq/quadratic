import { defaultFormatUpdate, describeFormatUpdates, expectedEnum } from '@/app/ai/tools/formatUpdate';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import type { ColumnRowResize } from '@/app/gridGL/interaction/pointer/PointerHeading';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type {
  CellAlign,
  CellVerticalAlign,
  CellWrap,
  FormatUpdate,
  JsSheetPosText,
  NumericFormat,
  NumericFormatKind,
  SheetRect,
} from '@/app/quadratic-core-types';
import { stringToSelection, xyToA1, type JsSelection } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { apiClient } from '@/shared/api/apiClient';
import { CELL_HEIGHT, CELL_TEXT_MARGIN_LEFT, CELL_WIDTH, MIN_CELL_WIDTH } from '@/shared/constants/gridConstants';
import { dataUrlToMimeTypeAndData, isSupportedImageMimeType } from 'quadratic-shared/ai/helpers/files.helper';
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
Think and reason about the error and try to fix it.
`
      ),
    ];
  }

  if (codeCell.spill_error) {
    return [
      createTextContent(
        `
The code cell has spilled, because the output overlaps with existing data on the sheet at position:
\`\`\`json\n
${JSON.stringify(codeCell.spill_error?.map((p) => ({ x: Number(p.x), y: Number(p.y) })))}
\`\`\`
Output size is ${tableCodeCell.w} cells wide and ${tableCodeCell.h} cells high.
Move the code cell to a new position to avoid spilling. Make sure the new position is not overlapping with existing data on the sheet.
`
      ),
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
          createTextContent('Executed set code cell value tool successfully to create a plotly chart.'),
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
          createTextContent('Executed set code cell value tool successfully to create a javascript chart.'),
        ];
      }
    }
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
          cursor: sheets.getCursorPosition(),
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
        await quadraticCore.setCellValues(sheetId, x, y, cell_values, sheets.getCursorPosition());

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
      let { sheet_name, code_cell_language, code_string, code_cell_position, code_cell_name } = args;
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
        return [createTextContent('Error executing set code cell value tool')];
      }
    } catch (e) {
      return [createTextContent(`Error executing set code cell value tool: ${e}`)];
    }
  },
  [AITool.SetFormulaCellValue]: async (args, messageMetaData) => {
    try {
      let { sheet_name, formula_string, code_cell_position } = args;
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

      const response = await quadraticCore.deleteCellValues(sourceSelection.save(), sheets.getCursorPosition());
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
        cursor: sheets.getCursorPosition(),
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
      if (typeof response === 'string') {
        return [createTextContent(response)];
      } else {
        return [createTextContent(`There was an error executing the get cells tool ${response?.error}`)];
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
      const sheetRect = sheets.selectionToSheetRect(sheetId, args.selection);
      if (!sheetRect) {
        return [createTextContent('Invalid selection, this should be a single rectangle, not a range')];
      }
      const response = await quadraticCore.gridToDataTable(
        sheetRect,
        args.table_name,
        args.first_row_is_column_names,
        sheets.getCursorPosition()
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
      const response = await quadraticCore.addSheet(
        sheet_name,
        insert_before_sheet_name ?? undefined,
        sheets.getCursorPosition()
      );
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
      const response = await quadraticCore.duplicateSheet(sheetId, name_of_new_sheet, sheets.getCursorPosition());
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
      const response = await quadraticCore.setSheetName(sheetId, new_name, sheets.getCursorPosition());
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
      const response = await quadraticCore.deleteSheet(sheetId, sheets.getCursorPosition());
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
      const response = await quadraticCore.moveSheet(sheetId, insertBeforeSheetId, sheets.getCursorPosition());
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
      const response = await quadraticCore.setSheetsColor(sheet_names_to_color, sheets.getCursorPosition());
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
      const response = await quadraticCore.rerunCodeCells(sheetId, selection ?? undefined, sheets.getCursorPosition());
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
        jsSelection = stringToSelection(selection, sheetId, sheets.jsA1Context);
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
          const maxWidth = await pixiApp.cellsSheets.getCellsContentMaxWidth(column);
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
        const response = await quadraticCore.resizeColumns(sheetId, resizing, sheets.getCursorPosition());
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
        jsSelection = stringToSelection(selection, sheetId, sheets.jsA1Context);
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
          const maxHeight = await pixiApp.cellsSheets.getCellsContentMaxHeight(row);
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
        const response = await quadraticCore.resizeRows(sheetId, resizing, sheets.getCursorPosition());
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
} as const;
