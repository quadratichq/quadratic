import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { AIToolSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { ConnectionTypeSchema } from 'quadratic-shared/typesAndSchemasConnections';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS (TypeScript-first)
// ============================================================================

// ----------------------------------------------------------------------------
// Provider and Model Types
// ----------------------------------------------------------------------------

export type AIProviders =
  | 'quadratic'
  | 'vertexai-anthropic'
  | 'vertexai'
  | 'geminiai'
  | 'bedrock-anthropic'
  | 'bedrock'
  | 'anthropic'
  | 'openai'
  | 'xai'
  | 'baseten'
  | 'fireworks'
  | 'open-router'
  | 'azure-openai';

export type QuadraticModel = 'quadratic-auto';

export type VertexAnthropicModel =
  | 'claude-sonnet-4-6@20260217'
  | 'claude-haiku-4-5@20251001'
  | 'claude-opus-4-5@20251101'
  | 'claude-opus-4-6@20260205';

export type VertexAIModel = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-3-flash' | 'gemini-3.1-pro-preview';

export type GenAIModel = 'gemini-2.5-flash-lite-preview-06-17';

export type BedrockAnthropicModel =
  | 'us.anthropic.claude-sonnet-4-6'
  | 'anthropic.claude-haiku-4-5-20251001-v1:0';

export type BedrockModel = 'us.deepseek.r1-v1:0';

export type AnthropicModel =
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001'
  | 'claude-opus-4-5-20251101'
  | 'claude-opus-4-6';

export type OpenAIModel =
  | 'gpt-5-codex'
  | 'gpt-5.2-2025-12-12'
  | 'gpt-4.1-2025-04-14'
  | 'o4-mini-2025-04-16'
  | 'o3-2025-04-16';

export type AzureOpenAIModel = 'gpt-5-codex' | 'gpt-5.2' | 'gpt-4.1' | 'gpt-4.1-mini' | 'o3';

export type XAIModel = 'grok-4-0709';

export type BasetenModel =
  | 'Qwen/Qwen3-Coder-480B-A35B-Instruct'
  | 'deepseek-ai/DeepSeek-V3.1'
  | 'moonshotai/Kimi-K2-Instruct-0905';

export type FireworksModel =
  | 'accounts/fireworks/models/qwen3-coder-480b-a35b-instruct'
  | 'accounts/fireworks/models/deepseek-v3p1';

export type OpenRouterModel = 'deepseek/deepseek-r1-0528';

export type AIModel =
  | QuadraticModel
  | VertexAnthropicModel
  | VertexAIModel
  | GenAIModel
  | BedrockAnthropicModel
  | BedrockModel
  | AnthropicModel
  | OpenAIModel
  | AzureOpenAIModel
  | XAIModel
  | BasetenModel
  | FireworksModel
  | OpenRouterModel;

// ----------------------------------------------------------------------------
// Model Key Types
// ----------------------------------------------------------------------------

export type QuadraticModelKey =
  | 'quadratic:quadratic-auto:thinking-toggle-off'
  | 'quadratic:quadratic-auto:thinking-toggle-on';

export type VertexAIAnthropicModelKey =
  | 'vertexai-anthropic:claude-sonnet-4-6@20260217:thinking-toggle-off'
  | 'vertexai-anthropic:claude-sonnet-4-6@20260217:thinking-toggle-on'
  | 'vertexai-anthropic:claude-sonnet-4-6@20260217'
  | 'vertexai-anthropic:claude-haiku-4-5@20251001:thinking-toggle-off'
  | 'vertexai-anthropic:claude-haiku-4-5@20251001:thinking-toggle-on'
  | 'vertexai-anthropic:claude-haiku-4-5@20251001'
  | 'vertexai-anthropic:claude-opus-4-5@20251101:thinking-toggle-off'
  | 'vertexai-anthropic:claude-opus-4-5@20251101:thinking-toggle-on'
  | 'vertexai-anthropic:claude-opus-4-5@20251101'
  | 'vertexai-anthropic:claude-opus-4-6@20260205:thinking-toggle-off'
  | 'vertexai-anthropic:claude-opus-4-6@20260205:thinking-toggle-on'
  | 'vertexai-anthropic:claude-opus-4-6@20260205';

export type VertexAIModelKey =
  | 'vertexai:gemini-2.5-flash:thinking-toggle-off'
  | 'vertexai:gemini-2.5-flash:thinking-toggle-on'
  | 'vertexai:gemini-2.5-flash-lite:thinking-toggle-off'
  | 'vertexai:gemini-2.5-flash-lite:thinking-toggle-on'
  | 'vertexai:gemini-3-flash'
  | 'vertexai:gemini-3.1-pro-preview';

export type GeminiAIModelKey = 'geminiai:gemini-2.5-flash-lite-preview-06-17';

export type BedrockAnthropicModelKey =
  | 'bedrock-anthropic:us.anthropic.claude-sonnet-4-6:thinking-toggle-off'
  | 'bedrock-anthropic:us.anthropic.claude-sonnet-4-6:thinking-toggle-on'
  | 'bedrock-anthropic:anthropic.claude-haiku-4-5-20251001-v1:0:thinking-toggle-off'
  | 'bedrock-anthropic:anthropic.claude-haiku-4-5-20251001-v1:0:thinking-toggle-on';

export type BedrockModelKey = 'bedrock:us.deepseek.r1-v1:0';

export type AnthropicModelKey =
  | 'anthropic:claude-sonnet-4.6:thinking-toggle-off'
  | 'anthropic:claude-sonnet-4.6:thinking-toggle-on'
  | 'anthropic:claude-haiku-4.5:thinking-toggle-off'
  | 'anthropic:claude-haiku-4.5:thinking-toggle-on'
  | 'anthropic:claude-opus-4.5:thinking-toggle-off'
  | 'anthropic:claude-opus-4.5:thinking-toggle-on'
  | 'anthropic:claude-opus-4.6:thinking-toggle-off'
  | 'anthropic:claude-opus-4.6:thinking-toggle-on';

export type OpenAIModelKey =
  | 'openai:gpt-5-codex'
  | 'openai:gpt-5.2-2025-12-12'
  | 'openai:gpt-4.1-2025-04-14'
  | 'openai:o4-mini-2025-04-16'
  | 'openai:o3-2025-04-16';

export type AzureOpenAIModelKey =
  | 'azure-openai:gpt-5-codex'
  | 'azure-openai:gpt-5.2'
  | 'azure-openai:gpt-4.1'
  | 'azure-openai:gpt-4.1-mini'
  | 'azure-openai:o3';

export type XAIModelKey = 'xai:grok-4-0709';

export type BasetenModelKey =
  | 'baseten:Qwen/Qwen3-Coder-480B-A35B-Instruct'
  | 'baseten:deepseek-ai/DeepSeek-V3.1'
  | 'baseten:moonshotai/Kimi-K2-Instruct-0905';

export type FireworksModelKey =
  | 'fireworks:accounts/fireworks/models/qwen3-coder-480b-a35b-instruct'
  | 'fireworks:accounts/fireworks/models/deepseek-v3p1';

export type OpenRouterModelKey = 'open-router:deepseek/deepseek-r1-0528';

export type AIModelKey =
  | QuadraticModelKey
  | VertexAIAnthropicModelKey
  | VertexAIModelKey
  | GeminiAIModelKey
  | BedrockAnthropicModelKey
  | BedrockModelKey
  | AnthropicModelKey
  | OpenAIModelKey
  | AzureOpenAIModelKey
  | XAIModelKey
  | BasetenModelKey
  | FireworksModelKey
  | OpenRouterModelKey;

// ----------------------------------------------------------------------------
// Model Configuration Types
// ----------------------------------------------------------------------------

export type ModelMode = 'disabled' | 'fast' | 'max' | 'others' | 'default';

export interface AIRates {
  rate_per_million_input_tokens: number;
  rate_per_million_output_tokens: number;
  rate_per_million_cache_read_tokens: number;
  rate_per_million_cache_write_tokens: number;
}

export interface AIModelConfig extends AIRates {
  model: AIModel;
  backupModelKey?: AIModelKey;
  displayName: string;
  displayProvider: string;
  temperature: number;
  max_tokens: number;
  canStream: boolean;
  canStreamWithToolCalls: boolean;
  mode: ModelMode;
  provider: AIProviders;
  promptCaching: boolean;
  strictParams?: boolean;
  thinking?: boolean;
  thinkingToggle?: boolean;
  thinkingBudget?: number;
  imageSupport: boolean;
  supportsReasoning?: boolean;
  serviceTier?: 'auto' | 'default' | 'flex' | 'scale' | 'priority';
  top_p?: number;
  top_k?: number;
  min_p?: number;
  repetition_penalty?: number;
  /** Input context window size in tokens. Used for context usage indicator. */
  contextLimit?: number;
}

// ----------------------------------------------------------------------------
// Context Types
// ----------------------------------------------------------------------------

export type InternalContextType =
  | 'quadraticDocs'
  | 'currentFile'
  | 'otherSheets'
  | 'currentSheet'
  | 'connections'
  | 'visibleData'
  | 'toolUse'
  | 'selection'
  | 'codeCell'
  | 'tables'
  | 'files'
  | 'modelRouter'
  | 'currentDate'
  | 'sheetNames'
  | 'sqlSchemas'
  | 'codeErrors'
  | 'fileSummary'
  | 'aiUpdates'
  | 'aiRules'
  | 'aiLanguages';

export type ToolResultContextType = 'toolResult';
export type UserPromptContextType = 'userPrompt';

export type CodeCellLanguage =
  | 'Python'
  | 'Javascript'
  | 'Formula'
  | 'Import'
  | { Connection: { kind: ConnectionType; id: string } };

export interface ImportFile {
  name: string;
  size: number;
}

export interface Context {
  codeCell?: {
    sheetId: string;
    pos: { x: number; y: number };
    language: CodeCellLanguage;
    lastModified: number;
  };
  connection?: {
    type: ConnectionType;
    id: string;
    name: string;
  };
  importFiles?: {
    prompt: string;
    files: ImportFile[];
  };
}

// ----------------------------------------------------------------------------
// Content Types
// ----------------------------------------------------------------------------

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'data';
  data: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  fileName: string;
}

export interface PdfFileContent {
  type: 'data';
  data: string;
  mimeType: 'application/pdf';
  fileName: string;
}

export interface TextFileContent {
  type: 'data';
  data: string;
  mimeType: 'text/plain';
  fileName: string;
}

export type FileContent = ImageContent | PdfFileContent | TextFileContent;

export interface GoogleSearchGroundingMetadata {
  type: 'google_search_grounding_metadata';
  text: string;
}

export type Content = (TextContent | FileContent)[];

export type ToolResultContent = (TextContent | ImageContent)[];

// ----------------------------------------------------------------------------
// AI Response Content Types (includes thinking/reasoning)
// ----------------------------------------------------------------------------

export interface AnthropicThinkingContent {
  type: 'anthropic_thinking';
  text: string;
  signature: string;
}

export interface AnthropicRedactedThinkingContent {
  type: 'anthropic_redacted_thinking';
  text: string;
}

export interface GoogleThinkingContent {
  type: 'google_thinking';
  text: string;
}

export interface OpenAIReasoningSummaryContent {
  type: 'openai_reasoning_summary';
  text: string;
  id: string;
}

export interface OpenAIReasoningContent {
  type: 'openai_reasoning_content';
  text: string;
  id: string;
}

export type OpenAIReasoningContentType = OpenAIReasoningSummaryContent | OpenAIReasoningContent;

export type AIResponseThinkingContent =
  | AnthropicThinkingContent
  | AnthropicRedactedThinkingContent
  | GoogleSearchGroundingMetadata
  | GoogleThinkingContent
  | OpenAIReasoningContentType;

export type AIResponseContent = (TextContent | AIResponseThinkingContent)[];

// ----------------------------------------------------------------------------
// Tool Call Types
// ----------------------------------------------------------------------------

export interface AIToolCall {
  id: string;
  name: string;
  arguments: string;
  loading: boolean;
  thoughtSignature?: string;
}

// ----------------------------------------------------------------------------
// Message Types
// ----------------------------------------------------------------------------

export interface SystemMessage {
  role: 'user';
  content: TextContent[];
  contextType: InternalContextType;
}

export interface ToolResult {
  id: string;
  content: ToolResultContent;
}

export interface ToolResultMessage {
  role: 'user';
  content: ToolResult[];
  contextType: ToolResultContextType;
}

export interface UserMessagePrompt {
  role: 'user';
  content: Content;
  contextType: UserPromptContextType;
  context?: Context;
}

export type UserMessage = SystemMessage | ToolResultMessage | UserMessagePrompt;

export interface AIMessageInternal {
  role: 'assistant';
  content: TextContent[];
  contextType: InternalContextType;
}

export interface AIMessagePrompt {
  role: 'assistant';
  content: AIResponseContent;
  contextType: UserPromptContextType;
  toolCalls: AIToolCall[];
  modelKey: string;
  id?: string;
}

export type AIMessage = AIMessageInternal | AIMessagePrompt;

// ----------------------------------------------------------------------------
// Internal Message Types
// ----------------------------------------------------------------------------

export interface GoogleSearchContent {
  source: 'google_search';
  query: string;
  results: (TextContent | GoogleSearchGroundingMetadata)[];
}

export interface InternalImportFile {
  fileName: string;
  loading: boolean;
  error?: string;
}

export interface ImportFilesToGridContent {
  source: 'import_files_to_grid';
  files: InternalImportFile[];
}

export type InternalMessage =
  | { role: 'internal'; contextType: 'webSearchInternal'; content: GoogleSearchContent }
  | { role: 'internal'; contextType: 'importFilesToGrid'; content: ImportFilesToGridContent };

// ----------------------------------------------------------------------------
// Chat Types
// ----------------------------------------------------------------------------

export type ChatMessage = UserMessage | AIMessage | InternalMessage;

export interface Chat {
  id: string;
  name: string;
  lastUpdated: number;
  messages: ChatMessage[];
}

// ----------------------------------------------------------------------------
// Tool Args Types (Recursive)
// ----------------------------------------------------------------------------

export type AIToolPrimitiveType = 'string' | 'number' | 'boolean' | 'null';

export interface AIToolArgsPrimitive {
  type: AIToolPrimitiveType | AIToolPrimitiveType[];
  description: string;
}

export interface AIToolArgsArray {
  type: 'array';
  items: AIToolArgsPrimitive | AIToolArgsArray | AIToolArgs;
}

export interface AIToolArgs {
  type: 'object';
  properties: Record<string, AIToolArgsPrimitive | AIToolArgsArray | AIToolArgs>;
  required: string[];
  additionalProperties: boolean;
  [key: string]: unknown;
}

// ----------------------------------------------------------------------------
// Code and Language Types
// ----------------------------------------------------------------------------

export type CodeCellType = 'Python' | 'Javascript' | 'Formula' | 'Connection' | 'Import';

export type AILanguagePreference = 'Python' | 'Javascript' | 'Formula';

export const allAILanguagePreferences: AILanguagePreference[] = ['Formula', 'Python', 'Javascript'];

export type AILanguagePreferences = AILanguagePreference[];

// ----------------------------------------------------------------------------
// Source and Request Types
// ----------------------------------------------------------------------------

export type AISource =
  | 'AIAssistant'
  | 'AIAnalyst'
  | 'AIResearcher'
  | 'GetChatName'
  | 'GetFileName'
  | 'CodeEditorCompletions'
  | 'GetUserPromptSuggestions'
  | 'GetEmptyChatPromptSuggestions'
  | 'PDFImport'
  | 'ModelRouter'
  | 'WebSearch'
  | 'OptimizePrompt';

export interface AIRequestBody {
  chatId: string;
  fileUuid: string;
  source: AISource;
  messageSource: string;
  modelKey: AIModelKey;
  messages: ChatMessage[];
  useStream: boolean;
  toolName?: AITool;
  useToolsPrompt: boolean;
  language?: CodeCellType;
  useQuadraticContext: boolean;
}

export type AIRequestHelperArgs = Omit<AIRequestBody, 'chatId' | 'fileUuid' | 'messageSource' | 'modelKey'>;

// ----------------------------------------------------------------------------
// Usage and Response Types
// ----------------------------------------------------------------------------

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  source?: AISource;
  modelKey?: AIModelKey;
  cost?: number;
}

export interface ParsedAIResponse {
  responseMessage: AIMessagePrompt;
  usage: AIUsage;
}

// ============================================================================
// ZOD SCHEMAS (for runtime validation)
// ============================================================================

// ----------------------------------------------------------------------------
// Provider and Model Schemas
// ----------------------------------------------------------------------------

const AIProvidersSchema = z.enum([
  'quadratic',
  'vertexai-anthropic',
  'vertexai',
  'geminiai',
  'bedrock-anthropic',
  'bedrock',
  'anthropic',
  'openai',
  'xai',
  'baseten',
  'fireworks',
  'open-router',
  'azure-openai',
]) satisfies z.ZodType<AIProviders>;

const QuadraticModelSchema = z.enum(['quadratic-auto']) satisfies z.ZodType<QuadraticModel>;

const VertexAnthropicModelSchema = z.enum([
  'claude-sonnet-4-6@20260217',
  'claude-haiku-4-5@20251001',
  'claude-opus-4-5@20251101',
  'claude-opus-4-6@20260205',
]) satisfies z.ZodType<VertexAnthropicModel>;

const VertexAIModelSchema = z.enum([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash',
  'gemini-3.1-pro-preview',
]) satisfies z.ZodType<VertexAIModel>;

const GenAIModelSchema = z.enum(['gemini-2.5-flash-lite-preview-06-17']) satisfies z.ZodType<GenAIModel>;

const BedrockAnthropicModelSchema = z.enum([
  'us.anthropic.claude-sonnet-4-6',
  'anthropic.claude-haiku-4-5-20251001-v1:0',
]) satisfies z.ZodType<BedrockAnthropicModel>;

const BedrockModelSchema = z.enum(['us.deepseek.r1-v1:0']) satisfies z.ZodType<BedrockModel>;

const AnthropicModelSchema = z.enum([
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-5-20251101',
  'claude-opus-4-6',
]) satisfies z.ZodType<AnthropicModel>;

const OpenAIModelSchema = z.enum([
  'gpt-5-codex',
  'gpt-5.2-2025-12-12',
  'gpt-4.1-2025-04-14',
  'o4-mini-2025-04-16',
  'o3-2025-04-16',
]) satisfies z.ZodType<OpenAIModel>;

const AzureOpenAIModelSchema = z.enum([
  'gpt-5-codex',
  'gpt-5.2',
  'gpt-4.1',
  'gpt-4.1-mini',
  'o3',
]) satisfies z.ZodType<AzureOpenAIModel>;

const XAIModelSchema = z.enum(['grok-4-0709']) satisfies z.ZodType<XAIModel>;

const BasetenModelSchema = z.enum([
  'Qwen/Qwen3-Coder-480B-A35B-Instruct',
  'deepseek-ai/DeepSeek-V3.1',
  'moonshotai/Kimi-K2-Instruct-0905',
]) satisfies z.ZodType<BasetenModel>;

const FireworksModelSchema = z.enum([
  'accounts/fireworks/models/qwen3-coder-480b-a35b-instruct',
  'accounts/fireworks/models/deepseek-v3p1',
]) satisfies z.ZodType<FireworksModel>;

const OpenRouterModelSchema = z.enum(['deepseek/deepseek-r1-0528']) satisfies z.ZodType<OpenRouterModel>;

const AIModelSchema = z.union([
  QuadraticModelSchema,
  VertexAnthropicModelSchema,
  VertexAIModelSchema,
  GenAIModelSchema,
  BedrockAnthropicModelSchema,
  BedrockModelSchema,
  AnthropicModelSchema,
  OpenAIModelSchema,
  AzureOpenAIModelSchema,
  XAIModelSchema,
  BasetenModelSchema,
  FireworksModelSchema,
  OpenRouterModelSchema,
]) satisfies z.ZodType<AIModel>;

// ----------------------------------------------------------------------------
// Model Key Schemas
// ----------------------------------------------------------------------------

const QuadraticModelKeySchema = z.enum([
  'quadratic:quadratic-auto:thinking-toggle-off',
  'quadratic:quadratic-auto:thinking-toggle-on',
]) satisfies z.ZodType<QuadraticModelKey>;

const VertexAIAnthropicModelKeySchema = z.enum([
  'vertexai-anthropic:claude-sonnet-4-6@20260217:thinking-toggle-off',
  'vertexai-anthropic:claude-sonnet-4-6@20260217:thinking-toggle-on',
  'vertexai-anthropic:claude-sonnet-4-6@20260217',
  'vertexai-anthropic:claude-haiku-4-5@20251001:thinking-toggle-off',
  'vertexai-anthropic:claude-haiku-4-5@20251001:thinking-toggle-on',
  'vertexai-anthropic:claude-haiku-4-5@20251001',
  'vertexai-anthropic:claude-opus-4-5@20251101:thinking-toggle-off',
  'vertexai-anthropic:claude-opus-4-5@20251101:thinking-toggle-on',
  'vertexai-anthropic:claude-opus-4-5@20251101',
  'vertexai-anthropic:claude-opus-4-6@20260205:thinking-toggle-off',
  'vertexai-anthropic:claude-opus-4-6@20260205:thinking-toggle-on',
  'vertexai-anthropic:claude-opus-4-6@20260205',
]) satisfies z.ZodType<VertexAIAnthropicModelKey>;

const VertexAIModelKeySchema = z.enum([
  'vertexai:gemini-2.5-flash:thinking-toggle-off',
  'vertexai:gemini-2.5-flash:thinking-toggle-on',
  'vertexai:gemini-2.5-flash-lite:thinking-toggle-off',
  'vertexai:gemini-2.5-flash-lite:thinking-toggle-on',
  'vertexai:gemini-3-flash',
  'vertexai:gemini-3.1-pro-preview',
]) satisfies z.ZodType<VertexAIModelKey>;

const GeminiAIModelKeySchema = z.enum([
  'geminiai:gemini-2.5-flash-lite-preview-06-17',
]) satisfies z.ZodType<GeminiAIModelKey>;

const BedrockAnthropicModelKeySchema = z.enum([
  'bedrock-anthropic:us.anthropic.claude-sonnet-4-6:thinking-toggle-off',
  'bedrock-anthropic:us.anthropic.claude-sonnet-4-6:thinking-toggle-on',
  'bedrock-anthropic:anthropic.claude-haiku-4-5-20251001-v1:0:thinking-toggle-off',
  'bedrock-anthropic:anthropic.claude-haiku-4-5-20251001-v1:0:thinking-toggle-on',
]) satisfies z.ZodType<BedrockAnthropicModelKey>;

const BedrockModelKeySchema = z.enum(['bedrock:us.deepseek.r1-v1:0']) satisfies z.ZodType<BedrockModelKey>;

const AnthropicModelKeySchema = z.enum([
  'anthropic:claude-sonnet-4.6:thinking-toggle-off',
  'anthropic:claude-sonnet-4.6:thinking-toggle-on',
  'anthropic:claude-haiku-4.5:thinking-toggle-off',
  'anthropic:claude-haiku-4.5:thinking-toggle-on',
  'anthropic:claude-opus-4.5:thinking-toggle-off',
  'anthropic:claude-opus-4.5:thinking-toggle-on',
  'anthropic:claude-opus-4.6:thinking-toggle-off',
  'anthropic:claude-opus-4.6:thinking-toggle-on',
]) satisfies z.ZodType<AnthropicModelKey>;

const OpenAIModelKeySchema = z.enum([
  'openai:gpt-5-codex',
  'openai:gpt-5.2-2025-12-12',
  'openai:gpt-4.1-2025-04-14',
  'openai:o4-mini-2025-04-16',
  'openai:o3-2025-04-16',
]) satisfies z.ZodType<OpenAIModelKey>;

const AzureOpenAIModelKeySchema = z.enum([
  'azure-openai:gpt-5-codex',
  'azure-openai:gpt-5.2',
  'azure-openai:gpt-4.1',
  'azure-openai:gpt-4.1-mini',
  'azure-openai:o3',
]) satisfies z.ZodType<AzureOpenAIModelKey>;

const XAIModelKeySchema = z.enum(['xai:grok-4-0709']) satisfies z.ZodType<XAIModelKey>;

const BasetenModelKeySchema = z.enum([
  'baseten:Qwen/Qwen3-Coder-480B-A35B-Instruct',
  'baseten:deepseek-ai/DeepSeek-V3.1',
  'baseten:moonshotai/Kimi-K2-Instruct-0905',
]) satisfies z.ZodType<BasetenModelKey>;

const FireworksModelKeySchema = z.enum([
  'fireworks:accounts/fireworks/models/qwen3-coder-480b-a35b-instruct',
  'fireworks:accounts/fireworks/models/deepseek-v3p1',
]) satisfies z.ZodType<FireworksModelKey>;

const OpenRouterModelKeySchema = z.enum([
  'open-router:deepseek/deepseek-r1-0528',
]) satisfies z.ZodType<OpenRouterModelKey>;

const AIModelKeySchema = z.union([
  QuadraticModelKeySchema,
  VertexAIAnthropicModelKeySchema,
  VertexAIModelKeySchema,
  GeminiAIModelKeySchema,
  BedrockAnthropicModelKeySchema,
  BedrockModelKeySchema,
  AnthropicModelKeySchema,
  OpenAIModelKeySchema,
  AzureOpenAIModelKeySchema,
  XAIModelKeySchema,
  BasetenModelKeySchema,
  FireworksModelKeySchema,
  OpenRouterModelKeySchema,
]) satisfies z.ZodType<AIModelKey>;

// ----------------------------------------------------------------------------
// Model Configuration Schemas
// ----------------------------------------------------------------------------

const ModelModeSchema = z.enum(['disabled', 'fast', 'max', 'others', 'default']) satisfies z.ZodType<ModelMode>;

const AIRatesSchema = z.object({
  rate_per_million_input_tokens: z.number(),
  rate_per_million_output_tokens: z.number(),
  rate_per_million_cache_read_tokens: z.number(),
  rate_per_million_cache_write_tokens: z.number(),
}) satisfies z.ZodType<AIRates>;

export const AIModelConfigSchema = z
  .object({
    model: AIModelSchema,
    backupModelKey: AIModelKeySchema.optional(),
    displayName: z.string(),
    displayProvider: z.string(),
    temperature: z.number(),
    max_tokens: z.number(),
    canStream: z.boolean(),
    canStreamWithToolCalls: z.boolean(),
    mode: ModelModeSchema,
    provider: AIProvidersSchema,
    promptCaching: z.boolean(),
    strictParams: z.boolean().optional(),
    thinking: z.boolean().optional(),
    thinkingToggle: z.boolean().optional(),
    thinkingBudget: z.number().optional(),
    imageSupport: z.boolean(),
    supportsReasoning: z.boolean().optional(),
    serviceTier: z.enum(['auto', 'default', 'flex', 'scale', 'priority']).optional(),
    top_p: z.number().optional(),
    top_k: z.number().optional(),
    min_p: z.number().optional(),
    repetition_penalty: z.number().optional(),
    contextLimit: z.number().optional(),
  })
  .extend(AIRatesSchema.shape) satisfies z.ZodType<AIModelConfig>;

// ----------------------------------------------------------------------------
// Context Schemas
// ----------------------------------------------------------------------------

const InternalContextTypeSchema = z.enum([
  'quadraticDocs',
  'currentFile',
  'otherSheets',
  'currentSheet',
  'connections',
  'visibleData',
  'toolUse',
  'selection',
  'codeCell',
  'tables',
  'files',
  'modelRouter',
  'currentDate',
  'sheetNames',
  'sqlSchemas',
  'codeErrors',
  'fileSummary',
  'aiUpdates',
  'aiRules',
  'aiLanguages',
]) satisfies z.ZodType<InternalContextType>;

const ToolResultContextTypeSchema = z.literal('toolResult') satisfies z.ZodType<ToolResultContextType>;
const UserPromptContextTypeSchema = z.literal('userPrompt') satisfies z.ZodType<UserPromptContextType>;

const CodeCellLanguageSchema: z.ZodType<CodeCellLanguage> = z.enum(['Python', 'Javascript', 'Formula', 'Import']).or(
  z.object({
    Connection: z.object({
      kind: ConnectionTypeSchema,
      id: z.string(),
    }),
  })
);

const ImportFileSchema = z.object({
  name: z.string(),
  size: z.number(),
}) satisfies z.ZodType<ImportFile>;

// Context schema with transform for lastModified default
const ContextSchema: z.ZodType<Context> = z.object({
  codeCell: z
    .object({
      sheetId: z.string(),
      pos: z.object({
        x: z.number(),
        y: z.number(),
      }),
      language: CodeCellLanguageSchema,
      lastModified: z
        .number()
        .optional()
        .transform((val) => val ?? 0),
    })
    .optional(),
  connection: z
    .object({
      type: ConnectionTypeSchema,
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  importFiles: z
    .object({
      prompt: z.string(),
      files: z.array(ImportFileSchema),
    })
    .optional(),
}) as z.ZodType<Context>;

// ----------------------------------------------------------------------------
// Content Schemas
// ----------------------------------------------------------------------------

// TextContent with preprocess for string migration
const TextContentSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === 'string') {
      return { type: 'text', text: val.trim() };
    }
    return val;
  },
  z.object({
    type: z.literal('text'),
    text: z.string().transform((val) => val.trim()),
  })
) as z.ZodType<TextContent>;

export const ImageContentSchema = z.object({
  type: z.literal('data'),
  data: z.string(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  fileName: z.string(),
}) satisfies z.ZodType<ImageContent>;

export const PdfFileContentSchema = z.object({
  type: z.literal('data'),
  data: z.string(),
  mimeType: z.literal('application/pdf'),
  fileName: z.string(),
}) satisfies z.ZodType<PdfFileContent>;

export const TextFileContentSchema = z.object({
  type: z.literal('data'),
  data: z.string(),
  mimeType: z.literal('text/plain'),
  fileName: z.string(),
}) satisfies z.ZodType<TextFileContent>;

export const FileContentSchema = z.union([
  ImageContentSchema,
  PdfFileContentSchema,
  TextFileContentSchema,
]) satisfies z.ZodType<FileContent>;

const GoogleSearchGroundingMetadataSchema = z.object({
  type: z.literal('google_search_grounding_metadata'),
  text: z.string().transform((val) => val.trim()),
}) as z.ZodType<GoogleSearchGroundingMetadata>;

const ContentSchema = z.array(z.union([TextContentSchema, FileContentSchema])) as z.ZodType<Content>;

const ToolResultContentSchema = z.array(
  z.union([TextContentSchema, ImageContentSchema])
) as z.ZodType<ToolResultContent>;

// ----------------------------------------------------------------------------
// AI Response Content Schemas (thinking/reasoning)
// ----------------------------------------------------------------------------

const OpenAIReasoningContentSchema = z
  .object({
    type: z.literal('openai_reasoning_summary'),
    text: z.string().transform((val) => val.trim()),
    id: z.string(),
  })
  .or(
    z.object({
      type: z.literal('openai_reasoning_content'),
      text: z.string().transform((val) => val.trim()),
      id: z.string(),
    })
  ) as z.ZodType<OpenAIReasoningContentType>;

const AIResponseThinkingContentSchema = z
  .object({
    type: z.literal('anthropic_thinking'),
    text: z.string().transform((val) => val.trim()),
    signature: z.string(),
  })
  .or(
    z.object({
      type: z.literal('anthropic_redacted_thinking'),
      text: z.string().transform((val) => val.trim()),
    })
  )
  .or(GoogleSearchGroundingMetadataSchema)
  .or(
    z.object({
      type: z.literal('google_thinking'),
      text: z.string().transform((val) => val.trim()),
    })
  )
  .or(OpenAIReasoningContentSchema) as z.ZodType<AIResponseThinkingContent>;

const AIResponseContentSchema = z.array(
  TextContentSchema.or(AIResponseThinkingContentSchema)
) as z.ZodType<AIResponseContent>;

// ----------------------------------------------------------------------------
// Tool Call Schemas
// ----------------------------------------------------------------------------

const AIToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.string(),
  loading: z.boolean(),
  thoughtSignature: z.string().optional(),
}) satisfies z.ZodType<AIToolCall>;

// ----------------------------------------------------------------------------
// Message Schemas
// ----------------------------------------------------------------------------

const SystemMessageSchema = z.object({
  role: z.literal('user'),
  content: z.preprocess((val) => {
    if (typeof val === 'string') {
      return [{ type: 'text', text: val.trim() }];
    }
    return val;
  }, z.array(TextContentSchema)),
  contextType: InternalContextTypeSchema,
}) as z.ZodType<SystemMessage>;

const ToolResultSchema = z.object({
  role: z.literal('user'),
  content: z.array(
    z.object({
      id: z.string(),
      content: ToolResultContentSchema,
    })
  ),
  contextType: ToolResultContextTypeSchema,
}) as z.ZodType<ToolResultMessage>;

// Helper function for string to content conversion
const convertStringToContent = (val: unknown): TextContent[] => {
  if (typeof val === 'string') {
    return val
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => !!line)
      .map((line) => ({ type: 'text' as const, text: line }));
  }
  return val as TextContent[];
};

const UserMessagePromptSchema = z.object({
  role: z.literal('user'),
  content: z.preprocess(convertStringToContent, ContentSchema),
  contextType: UserPromptContextTypeSchema,
  context: ContextSchema.optional(),
}) as z.ZodType<UserMessagePrompt>;

const UserMessageSchema = z.union([
  SystemMessageSchema,
  ToolResultSchema,
  UserMessagePromptSchema,
]) as z.ZodType<UserMessage>;

const AIMessageInternalSchema = z.object({
  role: z.literal('assistant'),
  content: z.array(TextContentSchema),
  contextType: InternalContextTypeSchema,
}) as z.ZodType<AIMessageInternal>;

export const AIMessagePromptSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === 'object' && val !== null && 'model' in val) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        modelKey: obj.model,
      };
    }
    return val;
  },
  z.object({
    role: z.literal('assistant'),
    content: z.preprocess(convertStringToContent, AIResponseContentSchema),
    contextType: UserPromptContextTypeSchema,
    toolCalls: z.array(AIToolCallSchema),
    modelKey: z.string(),
    id: z.string().optional(),
    error: z.boolean().optional(),
    errorType: z.enum(['context_length', 'general']).optional(),
  })
) as z.ZodType<AIMessagePrompt>;

const AIMessageSchema = z.union([AIMessageInternalSchema, AIMessagePromptSchema]) as z.ZodType<AIMessage>;

// ----------------------------------------------------------------------------
// Internal Message Schemas
// ----------------------------------------------------------------------------

const GoogleSearchContentSchema = z.object({
  source: z.literal('google_search'),
  query: z.string(),
  results: z.array(z.union([TextContentSchema, GoogleSearchGroundingMetadataSchema])),
}) as z.ZodType<GoogleSearchContent>;

const InternalImportFileSchema = z.object({
  fileName: z.string(),
  loading: z.boolean(),
  error: z.string().optional(),
}) satisfies z.ZodType<InternalImportFile>;

const ImportFilesToGridContentSchema = z.object({
  source: z.literal('import_files_to_grid'),
  files: z.array(InternalImportFileSchema),
}) satisfies z.ZodType<ImportFilesToGridContent>;

const InternalMessageSchema = z
  .object({
    role: z.literal('internal'),
    contextType: z.literal('webSearchInternal'),
    content: GoogleSearchContentSchema,
  })
  .or(
    z.object({
      role: z.literal('internal'),
      contextType: z.literal('importFilesToGrid'),
      content: ImportFilesToGridContentSchema,
    })
  ) as z.ZodType<InternalMessage>;

// ----------------------------------------------------------------------------
// Chat Schemas
// ----------------------------------------------------------------------------

const ChatMessageSchema = z.union([
  UserMessageSchema,
  AIMessageSchema,
  InternalMessageSchema,
]) as z.ZodType<ChatMessage>;

export const ChatMessagesSchema = z.array(ChatMessageSchema);

export const ChatSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastUpdated: z.number(),
  messages: ChatMessagesSchema,
}) satisfies z.ZodType<Chat>;

// ----------------------------------------------------------------------------
// Tool Args Schemas (Recursive)
// ----------------------------------------------------------------------------

const AIToolPrimitiveTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'null',
]) satisfies z.ZodType<AIToolPrimitiveType>;

const AIToolArgsPrimitiveSchema = z.object({
  type: AIToolPrimitiveTypeSchema.or(z.array(AIToolPrimitiveTypeSchema)),
  description: z.string(),
}) satisfies z.ZodType<AIToolArgsPrimitive>;

const AIToolArgsArraySchema: z.ZodType<AIToolArgsArray> = z.lazy(() =>
  z.object({
    type: z.literal('array'),
    items: AIToolArgsSchema,
  })
);

const AIToolArgsSchema: z.ZodType<AIToolArgs> = z.lazy(() =>
  z.object({
    type: z.literal('object'),
    properties: z.record(AIToolArgsPrimitiveSchema.or(AIToolArgsArraySchema).or(AIToolArgsSchema)),
    required: z.array(z.string()),
    additionalProperties: z.boolean(),
  })
);

// ----------------------------------------------------------------------------
// Code and Language Schemas
// ----------------------------------------------------------------------------

const CodeCellTypeSchema = z.enum([
  'Python',
  'Javascript',
  'Formula',
  'Connection',
  'Import',
]) satisfies z.ZodType<CodeCellType>;

export const AILanguagePreferenceSchema = z.enum([
  'Python',
  'Javascript',
  'Formula',
]) satisfies z.ZodType<AILanguagePreference>;

export const AILanguagePreferencesSchema = z.array(
  AILanguagePreferenceSchema
) satisfies z.ZodType<AILanguagePreferences>;

// ----------------------------------------------------------------------------
// Source and Request Schemas
// ----------------------------------------------------------------------------

const AISourceSchema = z.enum([
  'AIAssistant',
  'AIAnalyst',
  'AIResearcher',
  'GetChatName',
  'GetFileName',
  'CodeEditorCompletions',
  'GetUserPromptSuggestions',
  'GetEmptyChatPromptSuggestions',
  'PDFImport',
  'ModelRouter',
  'WebSearch',
  'OptimizePrompt',
]) satisfies z.ZodType<AISource>;

export const AIRequestBodySchema = z.object({
  chatId: z.string().uuid(),
  fileUuid: z.string().uuid(),
  source: AISourceSchema,
  messageSource: z.string(),
  modelKey: AIModelKeySchema,
  messages: z.array(ChatMessageSchema),
  useStream: z.boolean(),
  toolName: AIToolSchema.optional(),
  useToolsPrompt: z.boolean(),
  language: CodeCellTypeSchema.optional(),
  useQuadraticContext: z.boolean(),
}) satisfies z.ZodType<AIRequestBody>;

// ----------------------------------------------------------------------------
// Usage and Response Schemas
// ----------------------------------------------------------------------------

export const AIUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number(),
  cacheWriteTokens: z.number(),
  source: AISourceSchema.optional(),
  modelKey: AIModelKeySchema.optional(),
  cost: z.number().optional(),
}) satisfies z.ZodType<AIUsage>;

export const ParsedAIResponseSchema = z.object({
  responseMessage: AIMessagePromptSchema,
  usage: AIUsageSchema,
}) satisfies z.ZodType<ParsedAIResponse>;
