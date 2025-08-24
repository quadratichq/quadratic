import { editorInteractionStateFileUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import { AIToolSchema, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { type AIMessagePrompt, type AIRequestBody, type ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import type { SetterOrUpdater } from 'recoil';
import { useRecoilCallback } from 'recoil';

export const AI_FREE_TIER_WAIT_TIME_SECONDS = 5;

type HandleAIPromptProps = Omit<AIRequestBody, 'fileUuid'> & {
  setMessages?: SetterOrUpdater<ChatMessage[]> | ((value: React.SetStateAction<ChatMessage[]>) => void);
  signal: AbortSignal;
  onExceededBillingLimit?: (exceededBillingLimit: boolean) => void;
};

export function useAIRequestToAPI() {
  const { isOnPaidPlan, setIsOnPaidPlan } = useIsOnPaidPlan();

  const handleAIRequestToAPI = useRecoilCallback(
    ({ snapshot }) =>
      async ({
        setMessages,
        signal,
        onExceededBillingLimit,
        ...args
      }: HandleAIPromptProps): Promise<{
        error?: boolean;
        content: AIMessagePrompt['content'];
        toolCalls: AIMessagePrompt['toolCalls'];
      }> => {
        let responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
          role: 'assistant',
          content: [],
          contextType: 'userPrompt',
          toolCalls: [],
          modelKey: args.modelKey,
          isOnPaidPlan,
          exceededBillingLimit: false,
        };
        setMessages?.((prev) => [...prev, { ...responseMessage, content: [] }]);

        const { source, modelKey, useStream } = args;
        const fileUuid = await snapshot.getPromise(editorInteractionStateFileUuidAtom);

        try {
          const { stream } = getModelOptions(modelKey, { source, useStream });

          const endpoint = `${apiClient.getApiUrl()}/v0/ai/chat`;
          const token = await authClient.getTokenOrRedirect();
          const response = await fetch(endpoint, {
            method: 'POST',
            signal,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...args, fileUuid }),
          });

          if (!response.ok) {
            let data;
            try {
              data = await response.json();
            } catch (error) {
              data = '';
            }

            let text = '';
            switch (response.status) {
              case 429:
                text = 'You have exceeded the maximum number of requests. Please try again later.';
                break;
              case 402:
                text = 'You have exceeded your AI message limit. Please upgrade your plan to continue.';
                break;
              default:
                text = `Looks like there was a problem. Error: ${JSON.stringify(data.error)}`;
                break;
            }

            setMessages?.((prev) => [
              ...prev.slice(0, -1),
              {
                role: 'assistant',
                content: [createTextContent(text)],
                contextType: 'userPrompt',
                modelKey,
                toolCalls: [],
              },
            ]);
            console.error(`Error retrieving data from AI API. Error: ${data}`);
            return { error: true, content: [createTextContent(text)], toolCalls: [] };
          }

          if (stream) {
            // handle streaming response

            const reader = response.body?.getReader();
            if (!reader) throw new Error('Response body is not readable');

            const decoder = new TextDecoder();

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const newResponseMessage = ApiSchemas['/v0/ai/chat.POST.response'].parse(JSON.parse(line.slice(6)));
                    setMessages?.((prev) => [...prev.slice(0, -1), { ...newResponseMessage }]);
                    responseMessage = newResponseMessage;
                  } catch (error) {
                    console.warn('Error parsing AI response: ', { error, line });
                  }
                }
              }
            }
          }
          // handle non-streaming response
          else {
            const data = await response.json();
            const newResponseMessage = ApiSchemas['/v0/ai/chat.POST.response'].parse(data);
            setMessages?.((prev) => [...prev.slice(0, -1), { ...newResponseMessage }]);
            responseMessage = newResponseMessage;
          }

          // filter out tool calls that are not valid
          let newResponseMessage = {
            ...responseMessage,
            toolCalls: responseMessage.toolCalls.filter((toolCall) => {
              try {
                const aiTool = AIToolSchema.parse(toolCall.name);
                const argsObject = JSON.parse(toolCall.arguments);
                aiToolsSpec[aiTool].responseSchema.parse(argsObject);
                return true;
              } catch (error) {
                return false;
              }
            }),
          };
          if (newResponseMessage.content.length === 0 && newResponseMessage.toolCalls.length === 0) {
            newResponseMessage = {
              ...newResponseMessage,
              content: [createTextContent('Please try again.')],
            };
          }
          setMessages?.((prev) => [...prev.slice(0, -1), { ...newResponseMessage }]);
          responseMessage = newResponseMessage;

          setIsOnPaidPlan(responseMessage.isOnPaidPlan);
          onExceededBillingLimit?.(responseMessage.exceededBillingLimit);

          return {
            content: responseMessage.content,
            toolCalls: responseMessage.toolCalls,
            error: responseMessage.error,
          };
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return { error: false, content: [createTextContent('Aborted by user')], toolCalls: [] };
          } else {
            responseMessage = {
              ...responseMessage,
              content: [
                ...responseMessage.content,
                createTextContent('An error occurred while processing the response.'),
              ],
            };
            setMessages?.((prev) => [...prev.slice(0, -1), { ...responseMessage }]);
            console.error('Error in AI prompt handling:', err);
            return {
              error: true,
              content: [createTextContent('An error occurred while processing the response.')],
              toolCalls: [],
            };
          }
        }
      },
    [isOnPaidPlan, setIsOnPaidPlan]
  );

  return { handleAIRequestToAPI };
}
