import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import type { ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { useSummaryContextMessages } from '@/app/ai/hooks/useSummaryContextMessages';
import { getConnectionSchemaMarkdown, getConnectionTableInfo } from '@/app/ai/utils/aiConnectionContext';
import { aiAnalystFailingSqlConnectionsAtom } from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_GET_EMPTY_CHAT_PROMPT_SUGGESTIONS_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec, type AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage, Context, FileContent } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';
import type z from 'zod';

export type EmptyChatPromptSuggestions = z.infer<
  (typeof AIToolsArgsSchema)[AITool.EmptyChatPromptSuggestions]
>['prompt_suggestions'];

export const useGetEmptyChatPromptSuggestions = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { connections, isLoading: isConnectionsLoading } = useConnectionsFetcher();
  const { getSummaryContext } = useSummaryContextMessages();

  const getEmptyChatPromptSuggestions = useRecoilCallback(
    ({ snapshot }) =>
      async ({
        context,
        files,
        importFiles,
        sheetHasData,
        abortController,
      }: {
        context: Context;
        files: FileContent[];
        importFiles: ImportFile[];
        sheetHasData: boolean;
        abortController: AbortController;
      }): Promise<EmptyChatPromptSuggestions | undefined> => {
        try {
          if (isConnectionsLoading) {
            return;
          }

          const connection = connections.find((connection) => connection.uuid === context.connection?.id);

          // Return early only if there's no connection, no attached files, no import files, AND no data on the sheet
          if (!connection && files.length === 0 && importFiles.length === 0 && !sheetHasData) {
            return;
          }

          let connectionSchemaMarkdown: string = '';
          const failingSqlConnections = await snapshot.getPromise(aiAnalystFailingSqlConnectionsAtom);
          if (!!connection && !failingSqlConnections.uuids.includes(connection.uuid)) {
            try {
              const teamUuid = await snapshot.getPromise(editorInteractionStateTeamUuidAtom);
              const connectionTableInfo = await getConnectionTableInfo(connection, teamUuid);
              connectionSchemaMarkdown = !connectionTableInfo.error
                ? getConnectionSchemaMarkdown(connectionTableInfo)
                : '';
            } catch (error) {
              console.warn('[useGetEmptyChatPromptSuggestions] error: ', error);
            }
          }

          // Get sheet data summary if there's data on the sheet
          let sheetDataSummary: ChatMessage[] = [];
          if (sheetHasData) {
            sheetDataSummary = await getSummaryContext();
          }

          const messages: ChatMessage[] = [
            // Include sheet data summary context first
            ...sheetDataSummary,
            {
              role: 'user',
              content: [
                ...files,
                createTextContent(
                  `Use empty_chat_prompt_suggestions tool to provide three prompt suggestions for the user based on:\n
${
  sheetHasData
    ? ` - The spreadsheet already has data loaded (see the file summary context above). Generate suggestions relevant to analyzing, visualizing, or working with this existing data.`
    : ''
}

${
  !!context.connection && !!connectionSchemaMarkdown
    ? ` - User has selected a ${context.connection.type} connection named ${context.connection.name} with id ${context.connection.id}. Details of this connection are as follows for generating the prompt suggestions:
  ${connectionSchemaMarkdown}`
    : ''
}

${
  files.length > 0
    ? ` - User has attached ${files.length} chat files. These can be PDF or image files. PDF files need to be extracted using pdf_import tool, image files can be referenced or also extracted without using a dedicated tool. The file names and mime types are attached here for generating the prompt suggestions: ${files.map((file) => `${file.fileName} (${file.mimeType})`).join(', ')}`
    : ''
}

${
  importFiles.length > 0
    ? ` - User has attached ${importFiles.length} data files. These can be CSV, Excel, or Parquet files. These will be imported into the sheet before executing the prompt. The file names are attached here for generating the prompt suggestions: ${importFiles.map((file) => file.name).join(', ')}`
    : ''
}
                `
                ),
              ],
              contextType: 'userPrompt',
            },
          ];

          const response = await handleAIRequestToAPI({
            chatId: v4(),
            source: 'GetEmptyChatPromptSuggestions',
            messageSource: 'GetEmptyChatPromptSuggestions',
            modelKey: DEFAULT_GET_EMPTY_CHAT_PROMPT_SUGGESTIONS_MODEL,
            messages,
            signal: abortController.signal,
            useStream: false,
            toolName: AITool.EmptyChatPromptSuggestions,
            useToolsPrompt: false,
            language: undefined,
            useQuadraticContext: true,
          });

          const emptyChatPromptSuggestionsToolCall = response.toolCalls.find(
            (toolCall) => toolCall.name === AITool.EmptyChatPromptSuggestions
          );
          if (emptyChatPromptSuggestionsToolCall) {
            const argsObject = JSON.parse(emptyChatPromptSuggestionsToolCall.arguments);
            const args = aiToolsSpec[AITool.EmptyChatPromptSuggestions].responseSchema.parse(argsObject);
            return args.prompt_suggestions;
          }
        } catch (error) {
          console.error('[useGetEmptyChatPromptSuggestions] error: ', error);
        }
      },
    [handleAIRequestToAPI, connections, isConnectionsLoading, getSummaryContext]
  );

  return { getEmptyChatPromptSuggestions };
};
