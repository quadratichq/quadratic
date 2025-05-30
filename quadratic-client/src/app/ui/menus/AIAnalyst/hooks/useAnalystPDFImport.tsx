import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCurrentSheetContextMessages } from '@/app/ai/hooks/useCurrentSheetContextMessages';
import { useOtherSheetsContextMessages } from '@/app/ai/hooks/useOtherSheetsContextMessages';
import { useTablesContextMessages } from '@/app/ai/hooks/useTablesContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import { aiAnalystPDFImportAtom } from '@/app/atoms/aiAnalystAtom';
import { getPdfFileFromChatMessages } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_PDF_IMPORT_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage, Context, ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';
import type { z } from 'zod';

type PDFImportResponse = z.infer<(typeof aiToolsSpec)[AITool.PDFImport]['responseSchema']>;

export const useAnalystPDFImport = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getOtherSheetsContext } = useOtherSheetsContextMessages();
  const { getTablesContext } = useTablesContextMessages();
  const { getCurrentSheetContext } = useCurrentSheetContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();

  const importPDF = useRecoilCallback(
    ({ set }) =>
      async ({
        pdfImportArgs,
        context,
        chatMessages,
      }: {
        pdfImportArgs: PDFImportResponse;
        context: Context;
        chatMessages: ChatMessage[];
      }): Promise<ToolResultContent> => {
        let importPDFResult = '';
        try {
          const { file_name, prompt } = pdfImportArgs;
          const file = getPdfFileFromChatMessages(file_name, chatMessages);
          if (!file) {
            return [{ type: 'text', text: `File with name ${file_name} not found` }];
          }

          const [otherSheetsContext, tablesContext, currentSheetContext, visibleContext] = await Promise.all([
            getOtherSheetsContext({ sheetNames: context.sheets.filter((sheet) => sheet !== context.currentSheet) }),
            getTablesContext(),
            getCurrentSheetContext({ currentSheetName: context.currentSheet }),
            getVisibleContext(),
          ]);

          const messagesWithContext: ChatMessage[] = [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `
You are a pdf file importing tool which is tasked to extract data from PDF files to the spreadsheet as structured data tables which can be used for analysis or visualization.\n
Always stay true to the data in the original PDF file and create tables that accurately represent the information in the PDF. Never make up data or add extra information that is not present in the PDF.\n
Extract only that data which makes sense as a data table on a spreadsheet and can be used for analysis or visualization. Always follow user instructions exactly.\n
Use multiple add_data_table tool calls in reply to extract the required data from the PDF file.
You only have a single reply to extract all the required data tables, include add_data_table for all data in a single reply.\n
When adding data tables, space them out sufficiently on the sheet so that they don't overlap and create a spill over each other or over other data on the sheet.\n
Keep additional 3 rows and 3 columns of space between each data table, group related tables together while always ensuring they don't overlap.\n
Think and check about the space each table would take on the sheet and place them so that they have at least 3 rows and 3 columns of space between them.\n
Always prefer adding data tables vertically on the sheet, each 3 rows below the previous one. Place tables horizontally only when there is strong correlation between those two tables and is how they appear on the PDF, add each 3 columns to the right of previous one.\n
Always retain any column headers and row labels from the original PDF file when creating data tables, add a column name if some columns are missing headers.\n
`,
                },
              ],
              contextType: 'files',
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: `
I understand that I am a pdf file importing tool and I will use multiple add_data_table tool calls to extract the required data from the PDF file in a single response.\n
I will follow the instructions provided by the user to extract the required data tables.\n
How can I help you?`,
                },
              ],
              contextType: 'files',
            },
            ...otherSheetsContext,
            ...tablesContext,
            ...currentSheetContext,
            ...visibleContext,
            {
              role: 'user',
              content: [
                file,
                {
                  type: 'text',
                  text: prompt,
                },
              ],
              contextType: 'userPrompt',
            },
          ];

          const abortController = new AbortController();
          set(aiAnalystPDFImportAtom, { abortController, loading: true });

          const chatId = v4();
          const response = await handleAIRequestToAPI({
            chatId,
            source: 'PDFImport',
            modelKey: DEFAULT_PDF_IMPORT_MODEL,
            messages: messagesWithContext,
            useStream: true,
            toolName: AITool.AddDataTable,
            useToolsPrompt: true,
            language: undefined,
            useQuadraticContext: false,
            signal: abortController.signal,
          });

          if (abortController.signal.aborted) {
            return [{ type: 'text', text: 'Request aborted by the user.' }];
          }

          set(aiAnalystPDFImportAtom, { abortController: undefined, loading: false });

          const addDataTableToolCalls = response.toolCalls.filter((toolCall) => toolCall.name === AITool.AddDataTable);
          for (const toolCall of addDataTableToolCalls) {
            try {
              const argsObject = JSON.parse(toolCall.arguments);
              const args = aiToolsSpec[AITool.AddDataTable].responseSchema.parse(argsObject);
              await aiToolsActions[AITool.AddDataTable](args, {
                source: 'PDFImport',
                chatId,
                messageIndex: 0,
              });
              importPDFResult += `Added data table named ${args.table_name} at ${args.top_left_position}\n`;
            } catch (error) {
              console.error(error);
            }
          }
        } catch (error) {
          console.error(error);
          importPDFResult = `Error importing PDF file: ${JSON.stringify(error)}`;
        }
        if (!importPDFResult) {
          set(aiAnalystPDFImportAtom, { abortController: undefined, loading: false });
          importPDFResult = 'Unable to add any data table from the PDF';
        }
        return [{ type: 'text', text: importPDFResult }];
      },
    [handleAIRequestToAPI, getOtherSheetsContext, getTablesContext, getCurrentSheetContext, getVisibleContext]
  );

  return { importPDF };
};
