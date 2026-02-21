import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { teamBillingAtom, updateTeamBilling } from '@/shared/atom/teamBillingAtom';
import { getDefaultStore } from 'jotai';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { getModelOptions } from 'quadratic-shared/ai/helpers/model.helper';
import { AIToolSchema, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { AIRequestBody, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { aiStore, contextUsageAtom } from '../atoms/aiAnalystAtoms';
import type { AIAPIResponse, ExceededBillingLimitCallback, StreamingMessageCallback } from './types';

/**
 * Returns a deep clone of the message so callback consumers cannot mutate internal state.
 */
function cloneMessageForCallback<T extends ChatMessage>(message: T): T {
  return structuredClone(message);
}

/**
 * AIAPIClient handles communication with the AI API.
 * This is a pure class with no React dependencies.
 */
export class AIAPIClient {
  /**
   * Read paid plan status from the centralized billing atom
   */
  private getIsOnPaidPlan(): boolean {
    return getDefaultStore().get(teamBillingAtom).isOnPaidPlan;
  }

  /**
   * Update billing info from AI response using the centralized billing atom
   */
  private updateBillingInfoFromResponse(response: ApiTypes['/v0/ai/chat.POST.response']): void {
    const updates: Parameters<typeof updateTeamBilling>[0] = {};

    if (response.isOnPaidPlan !== undefined) {
      updates.isOnPaidPlan = response.isOnPaidPlan;
    }
    if (response.planType) {
      updates.planType = response.planType;
    }
    if (response.allowOveragePayments !== undefined) {
      updates.allowOveragePayments = response.allowOveragePayments;
    }

    if (Object.keys(updates).length > 0) {
      updateTeamBilling(updates);
    }
  }

  /**
   * Send a request to the AI API
   */
  async sendRequest(
    args: Omit<AIRequestBody, 'fileUuid'> & { fileUuid: string },
    options: {
      signal: AbortSignal;
      onMessage?: StreamingMessageCallback;
      onExceededBillingLimit?: ExceededBillingLimitCallback;
    }
  ): Promise<AIAPIResponse> {
    const { signal, onMessage, onExceededBillingLimit } = options;
    const { source, modelKey, useStream } = args;

    let responseMessage: ApiTypes['/v0/ai/chat.POST.response'] = {
      role: 'assistant',
      content: [],
      contextType: 'userPrompt',
      toolCalls: [],
      modelKey: args.modelKey,
      isOnPaidPlan: this.getIsOnPaidPlan(),
      exceededBillingLimit: false,
    };

    // Notify listener of initial empty message
    onMessage?.(cloneMessageForCallback(responseMessage));

    try {
      const { stream } = getModelOptions(modelKey, { source, useStream });

      const endpoint = `${apiClient.getApiUrl()}/v0/ai/chat`;
      const token = await authClient.getTokenOrRedirect();

      const response = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        return this.handleErrorResponse(response, modelKey, onMessage);
      }

      if (stream) {
        responseMessage = await this.handleStreamingResponse(response, responseMessage, onMessage);
      } else {
        responseMessage = await this.handleNonStreamingResponse(response, onMessage);
      }

      // Filter out invalid tool calls and track which ones failed
      const { message: filteredMessage, filteredTools } = this.filterInvalidToolCalls(responseMessage);
      responseMessage = filteredMessage;

      // Add feedback about filtered tool calls if any were removed
      if (filteredTools.length > 0) {
        const filteredContent = this.createFilteredToolsContent(filteredTools);
        responseMessage = {
          ...responseMessage,
          content: [...responseMessage.content, createTextContent(filteredContent)],
        };
      }

      // Ensure we have content or tool calls
      if (responseMessage.content.length === 0 && responseMessage.toolCalls.length === 0) {
        responseMessage = {
          ...responseMessage,
          content: [createTextContent('Please try again.')],
        };
      }

      onMessage?.(cloneMessageForCallback(responseMessage));
      onExceededBillingLimit?.(responseMessage.exceededBillingLimit);

      // Update billing info from response (planType, allowOveragePayments)
      this.updateBillingInfoFromResponse(responseMessage);

      // Update context usage atom with the latest usage data
      if (responseMessage.usage) {
        aiStore.set(contextUsageAtom, { usage: responseMessage.usage });
      }

      return {
        content: responseMessage.content,
        toolCalls: responseMessage.toolCalls,
        error: responseMessage.error,
        usage: responseMessage.usage,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { error: false, content: [createTextContent('Aborted by user')], toolCalls: [] };
      }

      const errorContent = [createTextContent('An error occurred while processing the response.')];
      const errorMessage = {
        ...responseMessage,
        content: [...responseMessage.content, ...errorContent],
      };
      onMessage?.(cloneMessageForCallback(errorMessage));

      console.error('Error in AI API request:', err);
      return { error: true, content: errorContent, toolCalls: [] };
    }
  }

  /**
   * Handle error responses from the API
   */
  private async handleErrorResponse(
    response: Response,
    modelKey: string,
    onMessage?: StreamingMessageCallback
  ): Promise<AIAPIResponse> {
    let data;
    try {
      data = await response.json();
    } catch {
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

    const errorMessage: ChatMessage = {
      role: 'assistant',
      content: [createTextContent(text)],
      contextType: 'userPrompt',
      modelKey,
      toolCalls: [],
    };
    onMessage?.(cloneMessageForCallback(errorMessage));

    console.error(`Error retrieving data from AI API. Error: ${JSON.stringify(data)}`);
    return { error: true, content: [createTextContent(text)], toolCalls: [] };
  }

  /**
   * Handle streaming responses
   */
  private async handleStreamingResponse(
    response: Response,
    initialMessage: ApiTypes['/v0/ai/chat.POST.response'],
    onMessage?: StreamingMessageCallback
  ): Promise<ApiTypes['/v0/ai/chat.POST.response']> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let responseMessage = initialMessage;
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const newResponseMessage = ApiSchemas['/v0/ai/chat.POST.response'].parse(JSON.parse(line.slice(6)));
              onMessage?.(cloneMessageForCallback(newResponseMessage));
              responseMessage = newResponseMessage;
            } catch (error) {
              console.warn('Error parsing AI response: ', { error, line });
            }
          }
        }
      }

      if (buffer.trim()) {
        if (buffer.startsWith('data: ')) {
          try {
            const newResponseMessage = ApiSchemas['/v0/ai/chat.POST.response'].parse(JSON.parse(buffer.slice(6)));
            onMessage?.(cloneMessageForCallback(newResponseMessage));
            responseMessage = newResponseMessage;
          } catch (error) {
            console.warn('Error parsing AI response: ', { error, line: buffer });
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return responseMessage;
  }

  /**
   * Handle non-streaming responses
   */
  private async handleNonStreamingResponse(
    response: Response,
    onMessage?: StreamingMessageCallback
  ): Promise<ApiTypes['/v0/ai/chat.POST.response']> {
    const data = await response.json();
    const responseMessage = ApiSchemas['/v0/ai/chat.POST.response'].parse(data);
    onMessage?.(cloneMessageForCallback(responseMessage));
    return responseMessage;
  }

  /**
   * Filter out invalid tool calls and track which ones failed
   */
  private filterInvalidToolCalls(message: ApiTypes['/v0/ai/chat.POST.response']): {
    message: ApiTypes['/v0/ai/chat.POST.response'];
    filteredTools: Array<{ name: string; reason: string }>;
  } {
    const filteredTools: Array<{ name: string; reason: string }> = [];

    const validToolCalls = message.toolCalls.filter((toolCall) => {
      try {
        const aiTool = AIToolSchema.parse(toolCall.name);
        const argsObject = JSON.parse(toolCall.arguments);
        aiToolsSpec[aiTool].responseSchema.parse(argsObject);
        return true;
      } catch (error) {
        const reason =
          error instanceof SyntaxError
            ? 'Invalid JSON in arguments'
            : error instanceof Error
              ? error.message
              : 'Unknown validation error';

        console.error('[AI Tool Filter] Filtering out invalid tool call:', {
          name: toolCall.name,
          arguments: toolCall.arguments,
          error,
        });

        filteredTools.push({ name: toolCall.name, reason });
        return false;
      }
    });

    return {
      message: { ...message, toolCalls: validToolCalls },
      filteredTools,
    };
  }

  /**
   * Create content message for filtered tool calls
   */
  private createFilteredToolsContent(filteredTools: Array<{ name: string; reason: string }>): string {
    const toolDescriptions = filteredTools.map((tool) => `- ${tool.name}: ${tool.reason}`).join('\n');
    return `The following tool calls failed validation and were not executed:\n${toolDescriptions}`;
  }
}

// Singleton instance for easy access
export const aiAPIClient = new AIAPIClient();
