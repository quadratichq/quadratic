import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { editorInteractionStateTeamUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo } from '@/app/helpers/codeCellLanguage';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_CODE_EDITOR_COMPLETIONS_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { v4 } from 'uuid';

interface HandleAICompletionProps {
  language: string;
  prefix: string;
  suffix: string;
  signal: AbortSignal;
}

export function useCodeEditorCompletions({ language }: { language: CodeCellLanguage }) {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const connectionInfo = useMemo(() => getConnectionInfo(language), [language]);
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const { data, isLoading } = useConnectionSchemaBrowser({
    type: connectionInfo?.kind,
    uuid: connectionInfo?.id,
    teamUuid,
  });
  const schemaJsonForAi = useMemo(() => (data ? JSON.stringify(data) : undefined), [data]);

  const getAICompletion = useCallback(
    async ({ prefix, suffix, language, signal }: HandleAICompletionProps): Promise<string> => {
      if (connectionInfo && isLoading) {
        return '';
      }

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            createTextContent(`You are a code editor assistant, you are inside a code editor of code cell of spreadsheet application called Quadratic.\n
The language of the code cell is ${language}.\n
${
  schemaJsonForAi &&
  `The schema for the database is:
\`\`\`json
${schemaJsonForAi}
\`\`\`
`
}
You have to use the code_editor_completions tool and provide the text delta to be inserted at the cursor position.\n

The code before the cursor is:\n
${JSON.stringify(prefix)}

The code after the cursor is:\n
${JSON.stringify(suffix)}

Include spaces and newlines as required, the text delta will be appended as is at the cursor position.\n

NEVER try to insert a cell reference inside the q.cells() function.\n 

Always try code changes to improve or fix the code only.\n

${
  language === 'Python'
    ? `
Never try to insert the following code:
- Never suggest .plot(), df.hist() or any other Pandas plotting function because only Plotly charts work 
- Never suggest anything with q. other than q.cells()
- Never suggest .to_json()
- Files can not be imported or exported using Python so don't recommend functions like to_csv()
- Never suggest Polars functions
`
    : ''
}`),
          ],
          contextType: 'userPrompt',
        },
      ];

      const response = await handleAIRequestToAPI({
        chatId: v4(),
        source: 'CodeEditorCompletions',
        messageSource: 'CodeEditorCompletions',
        modelKey: DEFAULT_CODE_EDITOR_COMPLETIONS_MODEL,
        messages,
        signal,
        useStream: true,
        toolName: AITool.CodeEditorCompletions,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      });

      let completion = '';

      const codeEditorCompletionsToolCall = response.toolCalls.find(
        (toolCall) => toolCall.name === AITool.CodeEditorCompletions
      );
      if (codeEditorCompletionsToolCall) {
        try {
          const argsObject = JSON.parse(codeEditorCompletionsToolCall.arguments);
          const args = aiToolsSpec[AITool.CodeEditorCompletions].responseSchema.parse(argsObject);
          completion = args.text_delta_at_cursor;
        } catch (error) {
          console.error('[useSubmitCodeEditorCompletions] toolCall: ', error);
        }
      }

      return completion;
    },
    [connectionInfo, isLoading, schemaJsonForAi, handleAIRequestToAPI]
  );

  return { getAICompletion };
}
