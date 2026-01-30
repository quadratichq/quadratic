import { describeFormatUpdates, expectedEnum } from '@/app/ai/tools/formatUpdate';
import { sheets } from '@/app/grid/controller/Sheets';
import type {
  BorderStyle,
  CellAlign,
  CellVerticalAlign,
  CellWrap,
  FormatUpdate,
  NumericFormat,
  NumericFormatKind,
} from '@/app/quadratic-core-types';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { FONT_SIZE_DISPLAY_ADJUSTMENT } from '@/shared/constants/gridConstants';
import Color from 'color';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';

type FormatToolActions = {
  [K in AITool.SetTextFormats | AITool.GetTextFormats | AITool.SetBorders | AITool.MergeCells | AITool.UnmergeCells]: (
    args: AIToolsArgs[K]
  ) => Promise<ToolResultContent>;
};

export const formatToolsActions: FormatToolActions = {
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
  [AITool.SetBorders]: async (args) => {
    try {
      const { sheet_name, selection, color, line, border_selection } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;

      let jsSelection;
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

      let jsSelection;
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

      let jsSelection;
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
} as const;
