import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a concise summary of what a code cell does using AI
 */
export const generateCodeCellSummary = async (
  codeString: string,
  language: string,
  signal?: AbortSignal
): Promise<string> => {
  try {
    console.log('[generateCodeCellSummary] Generating AI summary for:', language, codeString.substring(0, 100) + '...');

    // Get file UUID from pixiAppSettings
    const fileUuid = pixiAppSettings.editorInteractionState.fileUuid;
    if (!fileUuid) {
      console.warn('[generateCodeCellSummary] No file UUID available, falling back to simple summary');
      return getFallbackSummary(codeString, language);
    }

    // Prepare AI request following the same pattern as useAIRequestToAPI
    const chatId = uuidv4();
    const messages = [
      {
        role: 'user' as const,
        content: [
          createTextContent(`Please provide a concise summary of what this ${language} code does. Output a concise one-line sentence summary followed by a numbered list that includes: any existing data referenced, steps taken in the code, and what is returned.

Code:
\`\`\`${language.toLowerCase()}
${codeString}
\`\`\`

Respond with just the summary sentence and numbered list, nothing else.`),
        ],
        contextType: 'userPrompt' as const,
      },
    ];

    // Make AI request using the same structure as handleAIRequestToAPI
    const endpoint = `${apiClient.getApiUrl()}/v0/ai/chat`;
    const token = await authClient.getTokenOrRedirect();

    const requestBody = {
      chatId,
      fileUuid,
      messageSource: 'CodeCellSummary',
      modelKey: 'vertexai:gemini-2.5-flash:thinking-toggle-off' as const,
      source: 'AIAssistant' as const,
      messages,
      useToolsPrompt: false,
      useQuadraticContext: false,
      useStream: false,
      toolName: undefined,
      language: undefined,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn('[generateCodeCellSummary] AI request failed, falling back to simple summary');
      return getFallbackSummary(codeString, language);
    }

    const aiResponse = await response.json();

    // Extract text content from AI response
    if (aiResponse.content && aiResponse.content.length > 0) {
      const textContent = aiResponse.content.find((c: any) => c.type === 'text');
      if (textContent && textContent.text) {
        const summary = textContent.text.trim();
        console.log('[generateCodeCellSummary] AI generated summary:', summary);
        return summary;
      }
    }

    console.warn('[generateCodeCellSummary] No valid content in AI response, falling back to simple summary');
    return getFallbackSummary(codeString, language);
  } catch (error) {
    console.error('[generateCodeCellSummary] Error in AI summary generation:', error);
    return getFallbackSummary(codeString, language);
  }
};

/**
 * Fallback summary generation for when AI is unavailable
 */
function getFallbackSummary(codeString: string, language: string): string {
  const lowerCode = codeString.toLowerCase();

  // Quick pattern matching for common cases
  if (
    lowerCode.includes('plot') ||
    lowerCode.includes('chart') ||
    lowerCode.includes('matplotlib') ||
    lowerCode.includes('plotly')
  ) {
    return 'Creates a data visualization';
  }

  if (lowerCode.includes('pandas') || lowerCode.includes('dataframe')) {
    return 'Processes data using pandas';
  }

  if (lowerCode.includes('sum(') || lowerCode.includes('.sum()')) {
    return 'Calculates sum of values';
  }

  if (lowerCode.includes('mean(') || lowerCode.includes('.mean()')) {
    return 'Calculates average of values';
  }

  if (lowerCode.includes('read_csv') || lowerCode.includes('read_excel')) {
    return 'Loads data from file';
  }

  // Generic fallbacks
  if (language === 'Python') {
    return 'Executes Python code';
  } else if (language === 'Javascript') {
    return 'Executes JavaScript code';
  } else {
    return `Executes ${language} code`;
  }
}
