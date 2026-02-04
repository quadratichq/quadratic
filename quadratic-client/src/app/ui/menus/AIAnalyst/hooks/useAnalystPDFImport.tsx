import { aiStore, pdfImportAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useSummaryContextMessages } from '@/app/ai/hooks/useSummaryContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { createTextContent, getPdfFileFromChatMessages } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_PDF_IMPORT_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage, ToolResultContent } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { v4 } from 'uuid';
import type { z } from 'zod';

type PDFImportResponse = z.infer<(typeof aiToolsSpec)[AITool.PDFImport]['responseSchema']>;

export const useAnalystPDFImport = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getSummaryContext } = useSummaryContextMessages();

  const importPDF = useCallback(
    async ({
      pdfImportArgs,
      chatMessages,
    }: {
      pdfImportArgs: PDFImportResponse;
      chatMessages: ChatMessage[];
    }): Promise<ToolResultContent> => {
      let importPDFResult = '';
      try {
        const { file_name, prompt } = pdfImportArgs;
        const file = getPdfFileFromChatMessages(file_name, chatMessages);
        if (!file) {
          return [createTextContent(`File with name ${file_name} not found`)];
        }

        const [visibleContext, summaryContext] = await Promise.all([getVisibleContext(), getSummaryContext()]);

        const messagesWithContext: ChatMessage[] = [
          {
            role: 'user',
            content: [
              createTextContent(`
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
`),
            ],
            contextType: 'files',
          },
          {
            role: 'assistant',
            content: [
              createTextContent(`
I understand that I am a pdf file importing tool and I will use multiple add_data_table tool calls to extract the required data from the PDF file in a single response.\n
I will follow the instructions provided by the user to extract the required data tables.\n
How can I help you?`),
            ],
            contextType: 'files',
          },
          ...visibleContext,
          ...summaryContext,
          {
            role: 'user',
            content: [file, createTextContent(prompt)],
            contextType: 'userPrompt',
          },
        ];

        const abortController = new AbortController();
        aiStore.set(pdfImportAtom, { abortController, loading: true });

        const chatId = v4();
        const response = await handleAIRequestToAPI({
          chatId,
          source: 'PDFImport',
          messageSource: 'PDFImport',
          modelKey: DEFAULT_PDF_IMPORT_MODEL,
          messages: messagesWithContext,
          useStream: false,
          toolName: AITool.AddDataTable,
          useToolsPrompt: true,
          language: undefined,
          useQuadraticContext: false,
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) {
          return [createTextContent('Request aborted by the user.')];
        }

        aiStore.set(pdfImportAtom, { abortController: undefined, loading: false });

        const addDataTableToolCalls = response.toolCalls.filter((toolCall) => toolCall.name === AITool.AddDataTable);
        for (const toolCall of addDataTableToolCalls) {
          try {
            inlineEditorHandler.close({ skipFocusGrid: true });
            const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
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
        aiStore.set(pdfImportAtom, { abortController: undefined, loading: false });
        importPDFResult = 'Unable to add any data table from the PDF';
      }
      return [createTextContent(importPDFResult)];
    },
    [handleAIRequestToAPI, getSummaryContext, getVisibleContext]
  );

  return { importPDF };
};
