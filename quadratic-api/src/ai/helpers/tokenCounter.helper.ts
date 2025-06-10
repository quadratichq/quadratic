/**
 * Token Counter Helper for AI Requests
 *
 * This module provides token counting functionality for AI requests to enable
 * intelligent model routing based on request size.
 *
 * SETUP INSTRUCTIONS:
 * 1. Install tiktoken: `npm install tiktoken`
 * 2. Uses cl100k_base encoding for optimal performance across models
 * 3. Single tokenizer approach for maximum speed
 *
 * FEATURES:
 * - Counts tokens in text, images, and file content
 * - Provides routing recommendations based on token count
 * - Handles different message types (user, assistant, internal)
 * - Estimates overhead for tools and context
 * - Uses fastest cl100k_base encoding for all models
 *
 * USAGE:
 * - Use analyzeTokensForRouting() in model router for intelligent routing
 * - Use countTokensInRequest() for logging and monitoring
 * - Token counts help optimize cost and performance
 */

import {
  isContentImage,
  isContentPdfFile,
  isContentText,
  isContentTextFile,
} from 'quadratic-shared/ai/helpers/message.helper';
import type { AIModelKey, AIRequestHelperArgs, ChatMessage, Content } from 'quadratic-shared/typesAndSchemasAI';
import { get_encoding } from 'tiktoken';

// Use cl100k_base encoding for optimal performance
// This encoding is used by GPT-4 and GPT-3.5-turbo and provides
// the best balance of speed and accuracy across different models
const encoding = get_encoding('cl100k_base');

/**
 * Count tokens in a text string using tiktoken cl100k_base encoding
 */
export const countTokensInText = (text: string, modelKey?: AIModelKey): number => {
  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (error) {
    console.warn('Error counting tokens, using fallback estimation:', error);
    // Fallback: rough estimation based on words (1 token ≈ 0.75 words)
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    return Math.ceil(words.length / 0.75);
  }
};

/**
 * Count tokens in content array (handles text and file content)
 */
export const countTokensInContent = (content: Content, modelKey?: AIModelKey): number => {
  return content.reduce((total, item) => {
    if (isContentText(item)) {
      return total + countTokensInText(item.text, modelKey);
    } else if (isContentImage(item)) {
      // Images typically cost around 765 tokens for vision models
      return total + 765;
    } else if (isContentPdfFile(item) || isContentTextFile(item)) {
      // File content is usually extracted as text, account for filename
      return total + countTokensInText(item.fileName, modelKey) + 50; // Rough estimate for file metadata
    }
    return total;
  }, 0);
};

/**
 * Count tokens in a single chat message
 */
export const countTokensInMessage = (message: ChatMessage, modelKey?: AIModelKey): number => {
  let tokenCount = 0;

  // Role tokens (minimal overhead)
  tokenCount += 3; // Approximate overhead for role formatting

  if (message.role === 'user') {
    if (message.contextType === 'userPrompt') {
      // UserMessagePrompt
      if ('content' in message && message.content) {
        tokenCount += countTokensInContent(message.content, modelKey);
      }
    } else if (message.contextType === 'toolResult') {
      // ToolResultMessage
      if ('content' in message && message.content) {
        tokenCount += message.content.reduce((total, result) => {
          return (
            total +
            result.content.reduce((subtotal, contentItem) => {
              if (isContentText(contentItem)) {
                return subtotal + countTokensInText(contentItem.text, modelKey);
              } else if (isContentImage(contentItem)) {
                return subtotal + 765; // Image token estimate
              }
              return subtotal;
            }, 0)
          );
        }, 0);
      }
    } else {
      // SystemMessage
      if ('content' in message && message.content) {
        if (typeof message.content === 'string') {
          tokenCount += countTokensInText(message.content, modelKey);
        } else {
          tokenCount += message.content.reduce((total, item) => {
            return total + countTokensInText(item.text, modelKey);
          }, 0);
        }
      }
    }
  } else if (message.role === 'assistant') {
    // AIMessagePrompt or AIMessageInternal
    if ('content' in message && message.content) {
      tokenCount += message.content.reduce((total, item) => {
        if (isContentText(item)) {
          return total + countTokensInText(item.text, modelKey);
        }
        return total;
      }, 0);
    }

    // Tool calls if present
    if ('toolCalls' in message && message.toolCalls) {
      message.toolCalls.forEach((toolCall) => {
        tokenCount += countTokensInText(toolCall.name, modelKey);
        tokenCount += countTokensInText(toolCall.arguments, modelKey);
      });
    }
  } else if (message.role === 'internal') {
    // InternalMessage
    if ('content' in message && message.content) {
      tokenCount += countTokensInText(message.content.query, modelKey);
      tokenCount += message.content.results.reduce((total, result) => {
        if (result.type === 'text') {
          return total + countTokensInText(result.text, modelKey);
        }
        return total;
      }, 0);
    }
  }

  return tokenCount;
};

/**
 * Count total tokens in an AI request
 */
export const countTokensInRequest = (args: AIRequestHelperArgs, modelKey?: AIModelKey): number => {
  let totalTokens = 0;

  // Count tokens in all messages
  args.messages.forEach((message) => {
    totalTokens += countTokensInMessage(message, modelKey);
  });

  // Add overhead for system prompts and tool definitions
  if (args.useQuadraticContext) {
    totalTokens += 500; // Estimated tokens for Quadratic context
  }

  if (args.useToolsPrompt) {
    totalTokens += 1000; // Estimated tokens for tool definitions
  }

  return totalTokens;
};

/**
 * Interface for token count results
 */
export interface TokenCountResult {
  totalTokens: number;
}

/**
 * Count tokens for routing analysis
 */
export const analyzeTokensForRouting = (args: AIRequestHelperArgs, modelKey?: AIModelKey): TokenCountResult => {
  const totalTokens = countTokensInRequest(args, modelKey);

  return {
    totalTokens,
  };
};

/**
 * Cleanup function to free the encoding resources
 * Call this when shutting down the application
 */
export const cleanup = (): void => {
  try {
    encoding.free();
  } catch (error) {
    console.warn('Error freeing tiktoken encoding:', error);
  }
};
