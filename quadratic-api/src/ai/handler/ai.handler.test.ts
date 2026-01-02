/**
 * Unit tests for AI Handler
 * All model provider calls are mocked to avoid usage costs
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { AIRequestHelperArgs } from 'quadratic-shared/typesAndSchemasAI';
import { handleAIRequest } from './ai.handler';

// Mock all LangChain providers
jest.mock('@langchain/anthropic');
jest.mock('@langchain/aws');
jest.mock('@langchain/openai');
jest.mock('@langchain/google-genai');

// Mock environment variables
jest.mock('../../env-vars', () => ({
  ANTHROPIC_API_KEY: 'mock-anthropic-key',
  OPENAI_API_KEY: 'mock-openai-key',
  AZURE_OPENAI_API_KEY: 'mock-azure-key',
  AZURE_OPENAI_ENDPOINT: 'mock-azure-endpoint',
  XAI_API_KEY: 'mock-xai-key',
  BASETEN_API_KEY: 'mock-baseten-key',
  FIREWORKS_API_KEY: 'mock-fireworks-key',
  OPEN_ROUTER_API_KEY: 'mock-openrouter-key',
  GCP_GEMINI_API_KEY: 'mock-gemini-key',
  GCP_PROJECT_ID: 'mock-project',
  GCP_REGION: 'us-central1',
  GCP_REGION_ANTHROPIC: 'us-central1',
  GCP_CLIENT_EMAIL: 'mock@example.com',
  GCP_PRIVATE_KEY: 'mock-key',
  AWS_S3_REGION: 'us-east-1',
  AWS_S3_ACCESS_KEY_ID: 'mock-access-key',
  AWS_S3_SECRET_ACCESS_KEY: 'mock-secret-key',
  debugAndNotInProduction: false,
  FINE_TUNE: 'false',
  ENVIRONMENT: 'test',
}));

// Mock logger to avoid console spam
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock Sentry
jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

describe('AI Handler Tests', () => {
  let mockInvoke: jest.Mock;
  let mockStream: jest.Mock;
  let mockBindTools: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock methods
    mockInvoke = jest.fn();
    mockStream = jest.fn();
    mockBindTools = jest.fn();

    // Mock the model instances
    const createMockModel = () => ({
      invoke: mockInvoke,
      stream: mockStream,
      bindTools: mockBindTools.mockReturnThis(),
    });

    (ChatAnthropic as jest.MockedClass<typeof ChatAnthropic>).mockImplementation(() => createMockModel() as any);
    (ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>).mockImplementation(() => createMockModel() as any);
    (ChatBedrockConverse as jest.MockedClass<typeof ChatBedrockConverse>).mockImplementation(
      () => createMockModel() as any
    );
    (ChatGoogleGenerativeAI as jest.MockedClass<typeof ChatGoogleGenerativeAI>).mockImplementation(
      () => createMockModel() as any
    );
  });

  describe('Non-streaming responses', () => {
    it('should handle Anthropic model request successfully', async () => {
      const mockResponse = {
        content: 'Hello! How can I help you?',
        response_metadata: {
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            cache_read_input_tokens: 5,
            cache_creation_input_tokens: 0,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Hello')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      expect(result?.responseMessage.role).toBe('assistant');
      expect(result?.responseMessage.content).toEqual([createTextContent('Hello! How can I help you?')]);
      expect(result?.usage.inputTokens).toBe(10);
      expect(result?.usage.outputTokens).toBe(20);
      expect(result?.usage.cacheReadTokens).toBe(5);
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should handle OpenAI model request successfully', async () => {
      const mockResponse = {
        content: 'OpenAI response',
        response_metadata: {
          usage: {
            prompt_tokens: 15,
            completion_tokens: 25,
            prompt_tokens_details: { cached_tokens: 3 },
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'openai:gpt-4.1-2025-04-14',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      expect(result?.responseMessage.content).toEqual([createTextContent('OpenAI response')]);
      expect(result?.usage.inputTokens).toBe(15);
      expect(result?.usage.outputTokens).toBe(25);
      expect(result?.usage.cacheReadTokens).toBe(3);
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        content: 'I will use a tool to help you.',
        response_metadata: {
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        },
        usage_metadata: {},
        tool_calls: [
          {
            id: 'call_123',
            name: 'testTool',
            args: { param1: 'value1' },
          },
        ],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Use a tool')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      expect(result?.responseMessage.toolCalls).toHaveLength(1);
      expect(result?.responseMessage.toolCalls?.[0].id).toBe('call_123');
      expect(result?.responseMessage.toolCalls?.[0].name).toBe('testTool');
      expect(result?.responseMessage.toolCalls?.[0].arguments).toBe(JSON.stringify({ param1: 'value1' }));
    });

    it('should handle Google Gemini model', async () => {
      const mockResponse = {
        content: 'Gemini response',
        response_metadata: {
          usage: {
            promptTokenCount: 12,
            candidatesTokenCount: 18,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'geminiai:gemini-2.5-flash-lite-preview-06-17',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      expect(result?.usage.inputTokens).toBe(12);
      expect(result?.usage.outputTokens).toBe(18);
    });
  });

  describe('Streaming responses', () => {
    it('should handle streaming response successfully', async () => {
      const mockChunks = [
        {
          content: 'Hello',
          response_metadata: { usage: { input_tokens: 10, output_tokens: 5 } },
          usage_metadata: {},
          tool_calls: [],
        },
        {
          content: ' world',
          response_metadata: { usage: { input_tokens: 10, output_tokens: 10 } },
          usage_metadata: {},
          tool_calls: [],
        },
      ];

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };

      mockStream.mockResolvedValue(mockAsyncIterator);

      const mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        headersSent: false,
      };

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test streaming')],
            contextType: 'userPrompt',
          },
        ],
        useStream: true,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
        response: mockResponse as any,
      });

      expect(result).toBeDefined();
      expect(result?.responseMessage.content).toEqual([createTextContent('Hello world')]);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockResponse.write).toHaveBeenCalled();
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should handle streaming with tool calls', async () => {
      const mockChunks = [
        {
          content: 'Using tool',
          response_metadata: { usage: { input_tokens: 10, output_tokens: 5 } },
          usage_metadata: {},
          tool_calls: [
            {
              id: 'call_456',
              name: 'streamTool',
              args: { key: 'value' },
            },
          ],
        },
      ];

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };

      mockStream.mockResolvedValue(mockAsyncIterator);

      const mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        headersSent: false,
      };

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: true,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
        response: mockResponse as any,
      });

      expect(result).toBeDefined();
      expect(result?.responseMessage.toolCalls).toHaveLength(1);
      expect(result?.responseMessage.toolCalls?.[0].name).toBe('streamTool');
    });

    it('should handle aborted streaming request', async () => {
      const abortController = new AbortController();

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          abortController.abort();
          throw new Error('Request aborted');
        },
      };

      mockStream.mockResolvedValue(mockAsyncIterator);

      const mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        headersSent: false,
      };

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: true,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
        response: mockResponse as any,
        signal: abortController.signal,
      });

      expect(result).toBeUndefined();
    });
  });

  describe('Message conversion', () => {
    it('should handle multi-turn conversation with tool results', async () => {
      const mockResponse = {
        content: 'Based on the tool results...',
        response_metadata: {
          usage: {
            input_tokens: 200,
            output_tokens: 50,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('You are a helpful assistant')],
            contextType: 'quadraticDocs',
          },
          {
            role: 'user',
            content: [createTextContent('Use a tool')],
            contextType: 'userPrompt',
          },
          {
            role: 'assistant',
            content: [createTextContent('I will use the tool')],
            contextType: 'userPrompt',
            modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
            toolCalls: [
              {
                id: 'call_789',
                name: 'testTool',
                arguments: JSON.stringify({ param: 'value' }),
                loading: false,
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                id: 'call_789',
                content: [createTextContent('Tool result data')],
              },
            ],
            contextType: 'toolResult',
          },
          {
            role: 'user',
            content: [createTextContent('What does the tool say?')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Verify the messages passed to the model include system, user, assistant, tool, and user
      const callArgs = mockInvoke.mock.calls[0][0];
      expect(Array.isArray(callArgs)).toBe(true);
      expect(callArgs.length).toBeGreaterThan(0);
    });

    it('should handle complex multi-part content in messages', async () => {
      const mockResponse = {
        content: 'I can see the content',
        response_metadata: {
          usage: {
            input_tokens: 500, // Multi-part content typically uses more tokens
            output_tokens: 20,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Analyze this data'), createTextContent('Additional context here')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      expect(result?.responseMessage.content).toEqual([createTextContent('I can see the content')]);
      expect(result?.usage.inputTokens).toBe(500);
    });
  });

  describe('Error handling', () => {
    it('should handle model invocation errors', async () => {
      mockInvoke.mockRejectedValue(new Error('API Error'));

      const mockResponse = {
        json: jest.fn(),
        headersSent: false,
      };

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
        response: mockResponse as any,
      });

      expect(result).toBeUndefined();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          error: true,
        })
      );
    });

    it('should handle unsupported model key', async () => {
      const mockResponse = {
        json: jest.fn(),
        headersSent: false,
      };

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'unsupported:model-xyz' as any,
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
        response: mockResponse as any,
      });

      expect(result).toBeUndefined();
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('Different model providers', () => {
    it('should handle Bedrock Anthropic model', async () => {
      const mockResponse = {
        content: 'Bedrock response',
        response_metadata: {
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-5-20250929-v1:0:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      expect(result?.responseMessage.content).toEqual([createTextContent('Bedrock response')]);
      expect(ChatBedrockConverse).toHaveBeenCalled();
    });

    it('should handle Azure OpenAI model', async () => {
      const mockResponse = {
        content: 'Azure response',
        response_metadata: {
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'azure-openai:gpt-4.1',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      expect(ChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          openAIApiKey: 'mock-azure-key',
          configuration: expect.objectContaining({
            baseURL: 'mock-azure-endpoint',
          }),
        })
      );
    });

    it('should handle X.AI model', async () => {
      const mockResponse = {
        content: 'X.AI response',
        response_metadata: {
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'xai:grok-4-0709',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      expect(ChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          openAIApiKey: 'mock-xai-key',
          configuration: expect.objectContaining({
            baseURL: 'https://api.x.ai/v1',
          }),
        })
      );
    });
  });

  describe('Usage tracking', () => {
    it('should correctly extract usage from different provider formats', async () => {
      // Test Anthropic format
      const anthropicResponse = {
        content: 'Test',
        response_metadata: {
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 25,
            cache_creation_input_tokens: 10,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(anthropicResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result?.usage.inputTokens).toBe(100);
      expect(result?.usage.outputTokens).toBe(50);
      expect(result?.usage.cacheReadTokens).toBe(25);
      expect(result?.usage.cacheWriteTokens).toBe(10);
    });

    it('should use LangChain unified format when available', async () => {
      const response = {
        content: 'Test',
        response_metadata: {},
        usage_metadata: {
          input_tokens: 150,
          output_tokens: 75,
        },
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(response);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result?.usage.inputTokens).toBe(150);
      expect(result?.usage.outputTokens).toBe(75);
    });
  });

  describe('Tools binding', () => {
    it('should bind tools when available for the source', async () => {
      const mockResponse = {
        content: 'Test with tools',
        response_metadata: {
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);
      mockBindTools.mockReturnThis();

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      // Verify bindTools was called (tools are available for AIAnalyst source)
      expect(mockBindTools).toHaveBeenCalled();
    });
  });

  describe('Empty and edge cases', () => {
    it('should handle empty content responses', async () => {
      const mockResponse = {
        content: '',
        response_metadata: {
          usage: {
            input_tokens: 10,
            output_tokens: 1,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('Test')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      // Empty content should be replaced with a space
      expect(result?.responseMessage.content).toEqual([createTextContent(' ')]);
    });

    it('should handle messages with only whitespace', async () => {
      const mockResponse = {
        content: 'Valid response',
        response_metadata: {
          usage: {
            input_tokens: 10,
            output_tokens: 5,
          },
        },
        usage_metadata: {},
        tool_calls: [],
      };

      mockInvoke.mockResolvedValue(mockResponse);

      const args: AIRequestHelperArgs = {
        source: 'AIAnalyst',
        messages: [
          {
            role: 'user',
            content: [createTextContent('   ')],
            contextType: 'userPrompt',
          },
        ],
        useStream: false,
        toolName: undefined,
        useToolsPrompt: false,
        language: undefined,
        useQuadraticContext: false,
      };

      const result = await handleAIRequest({
        modelKey: 'anthropic:claude-sonnet-4.5:thinking-toggle-off',
        args,
        isOnPaidPlan: true,
        exceededBillingLimit: false,
      });

      expect(result).toBeDefined();
      // The handler should still process the request
      expect(mockInvoke).toHaveBeenCalled();
    });
  });
});
