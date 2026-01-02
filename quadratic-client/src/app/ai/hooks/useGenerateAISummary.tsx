import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_GET_CHAT_NAME_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useRef } from 'react';
import { v4 } from 'uuid';

export interface ChangeContext {
  label: string;
  name?: string;
  codeSnippet?: string;
  language?: string;
  dataPreview?: string;
}

export const useGenerateAISummary = () => {
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateSummary = useCallback(
    async (changes: ChangeContext[], userPrompt?: string): Promise<string> => {
      // Abort any previous request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      if (changes.length === 0) {
        return '';
      }

      // Build rich context for the AI
      const contextParts: string[] = [];
      const allNames: string[] = [];

      for (const change of changes) {
        let part = `- ${change.label}`;
        if (change.name) {
          part += ` "${change.name}"`;
          allNames.push(change.name);
        }
        if (change.language) part += ` (${change.language})`;
        if (change.codeSnippet) {
          // Include full code (truncated to reasonable length)
          const code = change.codeSnippet.slice(0, 500);
          part += `\n  Code:\n${code}`;
        }
        if (change.dataPreview) {
          part += `\n  Data: ${change.dataPreview.slice(0, 200)}`;
        }
        contextParts.push(part);
      }

      const changesText = contextParts.join('\n\n');
      const namesText = allNames.length > 0 ? `\nNames used: ${allNames.join(', ')}` : '';
      const userRequestText = userPrompt ? `\nUser's request: "${userPrompt}"` : '';

      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            createTextContent(
              `Summarize what was created/modified in this spreadsheet in 4 words or less. Focus on the PURPOSE or OUTPUT based on the user's request.
${userRequestText}
${namesText}

Changes made:
${changesText}

Good summaries describe what was built:
- "Sales analytics dashboard"
- "Monthly revenue chart"  
- "Customer data imported"
- "Expense calculations added"

Bad summaries are generic:
- "Wrote Python code"
- "Set cell values"
- "Code changes made"

Reply with ONLY the 4-word summary.`
            ),
          ],
          contextType: 'userPrompt',
        },
      ];

      try {
        const response = await handleAIRequestToAPI({
          chatId: v4(),
          source: 'GetChatName',
          messageSource: 'GetChatName',
          modelKey: DEFAULT_GET_CHAT_NAME_MODEL,
          messages,
          signal: abortController.signal,
          useStream: false,
          toolName: undefined,
          useToolsPrompt: false,
          language: undefined,
          useQuadraticContext: false,
        });

        // Extract text from response
        const textContent = response.content.find((c) => 'text' in c);
        if (textContent && 'text' in textContent) {
          // Clean up and limit to 4 words
          const words = textContent.text.trim().split(/\s+/);
          return words.slice(0, 4).join(' ');
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('[useGenerateAISummary] error:', error);
        }
      }

      // Fallback to generic summary
      return `${changes.length} changes made`;
    },
    [handleAIRequestToAPI]
  );

  const cancelSummary = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  return { generateSummary, cancelSummary };
};
