import { sheets } from '@/app/grid/controller/Sheets';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';

type SheetToolActions = {
  [K in
    | AITool.AddSheet
    | AITool.DuplicateSheet
    | AITool.RenameSheet
    | AITool.DeleteSheet
    | AITool.MoveSheet
    | AITool.ColorSheets]: (args: AIToolsArgs[K]) => Promise<ToolResultContent>;
};

export const sheetToolsActions: SheetToolActions = {
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
} as const;
