import type { AIToolMessageMetaData } from '@/app/ai/tools/aiToolsHelpers';
import { setCodeCellResult, waitForSetCodeCellValue } from '@/app/ai/tools/aiToolsHelpers';
import { codeCellToMarkdown } from '@/app/ai/utils/codeCellToMarkdown';
import { sheets } from '@/app/grid/controller/Sheets';
import { ensureRectVisible } from '@/app/gridGL/interaction/viewportHelper';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsCoordinate, SheetPos, SheetRect } from '@/app/quadratic-core-types';
import { convertTableToSheetPos, xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';

type CodeToolActions = {
  [K in AITool.GetCodeCellValue | AITool.SetCodeCellValue | AITool.SetFormulaCellValue | AITool.RerunCode]: (
    args: AIToolsArgs[K],
    messageMetaData: AIToolMessageMetaData
  ) => Promise<ToolResultContent>;
} & {
  [K in AITool.UpdateCodeCell]: (
    args: AIToolsArgs[K],
    messageMetaData: AIToolMessageMetaData
  ) => Promise<ToolResultContent>;
} & {
  [K in AITool.CodeEditorCompletions]: (args: AIToolsArgs[K]) => Promise<ToolResultContent>;
};

export const codeToolsActions: CodeToolActions = {
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
      } catch (e) {
        // empty catch since the table no longer exist
      }
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
  [AITool.SetCodeCellValue]: async (args, messageMetaData) => {
    try {
      const { sheet_name, code_cell_name, code_cell_language, code_cell_position, code_string } = args;
      const sheetId = sheet_name ? (sheets.getSheetByName(sheet_name)?.id ?? sheets.current) : sheets.current;
      const selection = sheets.stringToSelection(code_cell_position, sheetId);
      if (!selection.isSingleSelection(sheets.jsA1Context)) {
        return [createTextContent('Invalid code cell position, this should be a single cell, not a range')];
      }

      const { x, y } = selection.getCursor();

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
  [AITool.SetFormulaCellValue]: async (args) => {
    try {
      const { formulas } = args;

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
} as const;
