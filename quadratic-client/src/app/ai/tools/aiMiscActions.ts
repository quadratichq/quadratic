import { countWords } from '@/app/ai/utils/wordCount';
import { sheets } from '@/app/grid/controller/Sheets';
import type { JsSheetPosText } from '@/app/quadratic-core-types';
import { xyToA1 } from '@/app/quadratic-core/quadratic_core';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';

type MiscToolActions = {
  [K in
    | AITool.SetAIModel
    | AITool.SetChatName
    | AITool.SetFileName
    | AITool.UserPromptSuggestions
    | AITool.EmptyChatPromptSuggestions
    | AITool.CategorizedEmptyChatPromptSuggestions
    | AITool.PDFImport
    | AITool.WebSearch
    | AITool.WebSearchInternal
    | AITool.TextSearch
    | AITool.Undo
    | AITool.Redo
    | AITool.ContactUs
    | AITool.OptimizePrompt]: (args: AIToolsArgs[K]) => Promise<ToolResultContent>;
};

export const miscToolsActions: MiscToolActions = {
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
  [AITool.WebSearch]: async () => {
    return [createTextContent('Search tool executed successfully.')];
  },
  [AITool.WebSearchInternal]: async () => {
    return [createTextContent('Web search tool executed successfully.')];
  },
  [AITool.TextSearch]: async (args) => {
    try {
      const { query, case_sensitive, whole_cell, search_code, sheet_name, regex } = args;
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
        regex: regex ?? null,
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
  [AITool.ContactUs]: async () => {
    // This tool doesn't perform any action - it just returns content
    // The actual UI interaction (opening feedback modal) is handled in the tool card component
    return [createTextContent('Please use the buttons below to contact our team or start a new chat.')];
  },
  [AITool.OptimizePrompt]: async (args) => {
    return [createTextContent(`Optimized prompt: ${args.optimized_prompt}`)];
  },
} as const;
