import type {
  AIMessagePrompt,
  AIModelKey,
  AIResponseContent,
  AIResponseThinkingContent,
  ChatMessage,
  Content,
  GoogleSearchContent,
  GoogleSearchGroundingMetadata,
  ImageContent,
  ImportFilesToGridContent,
  InternalMessage,
  OpenAIReasoningContentType,
  PdfFileContent,
  SystemMessage,
  TextContent,
  TextFileContent,
  ToolResultContextType,
  ToolResultMessage,
  UserMessagePrompt,
  UserPromptContextType,
} from 'quadratic-shared/typesAndSchemasAI';
import { isQuadraticModel } from './model.helper';

export const CLEAN_UP_TOOL_CALLS_AFTER = 3;

const getSystemMessages = (messages: ChatMessage[]): string[] => {
  const systemMessages: SystemMessage[] = messages.filter<SystemMessage>(
    (message): message is SystemMessage =>
      message.role === 'user' && message.contextType !== 'userPrompt' && message.contextType !== 'toolResult'
  );
  return systemMessages.flatMap((message) => message.content.map((content) => content.text));
};

const getPromptMessages = (messages: ChatMessage[]): (UserMessagePrompt | ToolResultMessage | AIMessagePrompt)[] => {
  return messages.filter((message) => message.contextType === 'userPrompt' || message.contextType === 'toolResult');
};

export const getPromptAndInternalMessages = (
  messages: ChatMessage[]
): (UserMessagePrompt | ToolResultMessage | AIMessagePrompt | InternalMessage)[] => {
  return messages.filter(
    (message) =>
      message.contextType === 'userPrompt' || message.contextType === 'toolResult' || message.role === 'internal'
  );
};

const getPromptMessagesWithoutPDF = (messages: ChatMessage[]): ChatMessage[] => {
  return messages.map((message) => {
    if (message.role !== 'user' || message.contextType !== 'userPrompt') {
      return message;
    }

    return {
      ...message,
      content: message.content.filter((content) => !isContentPdfFile(content)),
    };
  });
};

export const getMessagesForAI = (messages: ChatMessage[]): ChatMessage[] => {
  const messagesWithoutPDF = getPromptMessagesWithoutPDF(messages);
  const messagesWithoutInternal = messagesWithoutPDF.filter((message) => !isInternalMessage(message));

  const messagesWithUserContext = messagesWithoutInternal.map((message) => {
    if (!isUserPromptMessage(message)) {
      return { ...message };
    }

    const userMessage = { ...message };
    if (message.context?.connection) {
      userMessage.content = [
        createTextContent(`NOTE: This is an internal message for context. Do not quote it in your response.\n\n
User has selected a connection and want to focus on it:

Connection Details:
type: ${message.context.connection.type}
id: ${message.context.connection.id}
name: ${message.context.connection.name}
`),
        ...userMessage.content,
      ];
    }

    if (message.context?.importFiles?.prompt) {
      userMessage.content = [
        createTextContent(`NOTE: This is an internal message for context. Do not quote it in your response.\n\n
User attached files with this prompt and they were imported as:
${message.context.importFiles.prompt}
`),
        ...userMessage.content,
      ];
    }

    return userMessage;
  });
  return messagesWithUserContext;
};

export const getPromptMessagesForAI = (
  messages: ChatMessage[]
): (UserMessagePrompt | ToolResultMessage | AIMessagePrompt)[] => {
  return getPromptMessages(getPromptMessagesWithoutPDF(messages));
};

export const removeOldFilesInToolResult = (messages: ChatMessage[], files: Set<string>): ChatMessage[] => {
  return messages.map((message) => {
    if (message.contextType !== 'toolResult') {
      return message;
    }

    return {
      ...message,
      content: message.content.map((result) => ({
        id: result.id,
        content:
          result.content.length === 1
            ? result.content
            : result.content.filter((content) => isContentText(content) || !files.has(content.fileName)),
      })),
    };
  });
};

export const getUserMessages = (messages: ChatMessage[]): (UserMessagePrompt | ToolResultMessage)[] => {
  return getPromptMessages(messages).filter(
    (message): message is UserMessagePrompt | ToolResultMessage => message.role === 'user'
  );
};

export const getUserPromptMessages = (messages: ChatMessage[]): UserMessagePrompt[] => {
  return messages.filter(
    (message): message is UserMessagePrompt => message.role === 'user' && message.contextType === 'userPrompt'
  );
};

const getAIPromptMessages = (messages: ChatMessage[]): AIMessagePrompt[] => {
  return getPromptMessages(messages).filter((message): message is AIMessagePrompt => message.role === 'assistant');
};

export const getLastUserMessage = (messages: ChatMessage[]): UserMessagePrompt | ToolResultMessage => {
  const userMessages = getUserMessages(messages);
  return userMessages[userMessages.length - 1];
};

export const getLastUserMessageType = (messages: ChatMessage[]): UserPromptContextType | ToolResultContextType => {
  return getLastUserMessage(messages).contextType;
};

export const getLastAIPromptMessageIndex = (messages: ChatMessage[]): number => {
  return getAIPromptMessages(messages).length - 1;
};

export const getLastAIPromptMessageModelKey = (messages: ChatMessage[]): AIModelKey | undefined => {
  const aiPromptMessages = getAIPromptMessages(messages);
  for (let i = aiPromptMessages.length - 1; i >= 0; i--) {
    const message = aiPromptMessages[i];
    if (!!message.modelKey && !isQuadraticModel(message.modelKey as AIModelKey)) {
      return message.modelKey as AIModelKey;
    }
  }
};

export const getSystemPromptMessages = (
  messages: ChatMessage[]
): { systemMessages: string[]; promptMessages: ChatMessage[] } => {
  // send internal context messages as system messages
  const systemMessages: string[] = getSystemMessages(messages);
  const promptMessages = getPromptMessages(messages);

  // send all messages as prompt messages
  // const systemMessages: string[] = [];
  // const promptMessages = messages;

  return { systemMessages, promptMessages };
};

export const isUserPromptMessage = (message: ChatMessage): message is UserMessagePrompt => {
  return message.role === 'user' && message.contextType === 'userPrompt';
};

export const isAIPromptMessage = (message: ChatMessage): message is AIMessagePrompt => {
  return message.role === 'assistant' && message.contextType === 'userPrompt';
};

export const isToolResultMessage = (message: ChatMessage): message is ToolResultMessage => {
  return message.role === 'user' && message.contextType === 'toolResult';
};

export const isInternalMessage = (message: ChatMessage): message is InternalMessage => {
  return message.role === 'internal';
};

export const isContentText = (content: Content[number] | AIResponseContent[number]): content is TextContent => {
  return content.type === 'text';
};

export const isContentThinking = (
  content: Content[number] | AIResponseContent[number]
): content is AIResponseThinkingContent => {
  return ['anthropic_thinking', 'google_thinking', 'openai_reasoning_summary', 'openai_reasoning_content'].includes(
    content.type
  );
};

export const isContentOpenAIReasoning = (
  content: Content[number] | AIResponseContent[number]
): content is OpenAIReasoningContentType => {
  return ['openai_reasoning_summary', 'openai_reasoning_content'].includes(content.type);
};

export const isContentImage = (content: Content[number] | AIResponseContent[number]): content is ImageContent => {
  return content.type === 'data' && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(content.mimeType);
};

export const isContentPdfFile = (content: Content[number] | AIResponseContent[number]): content is PdfFileContent => {
  return content.type === 'data' && content.mimeType === 'application/pdf';
};

export const isContentTextFile = (content: Content[number] | AIResponseContent[number]): content is TextFileContent => {
  return content.type === 'data' && content.mimeType === 'text/plain';
};

export const isContentFile = (
  content: Content[number] | AIResponseContent[number]
): content is ImageContent | PdfFileContent | TextFileContent => {
  return isContentImage(content) || isContentPdfFile(content) || isContentTextFile(content);
};

export const isContentGoogleSearchInternal = (content: InternalMessage['content']): content is GoogleSearchContent => {
  return content.source === 'google_search';
};

export const isContentImportFilesToGridInternal = (
  content: InternalMessage['content']
): content is ImportFilesToGridContent => {
  return content.source === 'import_files_to_grid';
};

export const isContentGoogleSearchGroundingMetadata = (
  content: Content[number] | AIResponseContent[number]
): content is GoogleSearchGroundingMetadata => {
  return content.type === 'google_search_grounding_metadata';
};

export const filterImageFilesInChatMessages = (messages: ChatMessage[]): ImageContent[] => {
  return getUserMessages(messages)
    .filter((message) => message.contextType === 'userPrompt')
    .flatMap((message) => message.content)
    .filter(isContentImage);
};

export const filterPdfFilesInChatMessages = (messages: ChatMessage[]): PdfFileContent[] => {
  return getUserMessages(messages)
    .filter((message) => message.contextType === 'userPrompt')
    .flatMap((message) => message.content)
    .filter(isContentPdfFile);
};

export const getPdfFileFromChatMessages = (fileName: string, messages: ChatMessage[]): PdfFileContent | undefined => {
  return filterPdfFilesInChatMessages(messages).find((content) => content.fileName === fileName);
};

export const createTextContent = (text: string): TextContent => {
  return {
    type: 'text' as const,
    text,
  };
};

export const createInternalImportFilesContent = (
  importFilesToGridContent: ImportFilesToGridContent
): InternalMessage => {
  return {
    role: 'internal' as const,
    contextType: 'importFilesToGrid' as const,
    content: { ...importFilesToGridContent },
  };
};

/**
 * Tools whose results and/or arguments should be compressed after
 * the most recent N occurrences.
 *
 * - compressArgs: if true, the tool call arguments on the assistant
 *   message will also be truncated (for tools that send large payloads
 *   in their arguments, e.g. full code bodies or 2D data arrays).
 */
const COMPRESSIBLE_TOOLS: Record<string, { keepLast: number; compressArgs: boolean }> = {
  get_cell_data: { keepLast: 2, compressArgs: false },
  get_text_formats: { keepLast: 2, compressArgs: false },
  text_search: { keepLast: 2, compressArgs: false },
  set_code_cell_value: { keepLast: 2, compressArgs: true },
  set_formula_cell_value: { keepLast: 2, compressArgs: true },
  set_sql_code_cell_value: { keepLast: 2, compressArgs: true },
  get_code_cell_value: { keepLast: 2, compressArgs: false },
  set_cell_values: { keepLast: 2, compressArgs: true },
  add_data_table: { keepLast: 2, compressArgs: true },
};

const RESULT_COMPRESSED_MESSAGE =
  'NOTE: The full results from this tool call have been removed from context to save space. Use the tool again if you need the data.';

const ARGS_COMPRESSED_MESSAGE = '[content compressed to save context space]';

/**
 * Per-tool metadata keys to preserve when compressing arguments.
 * Any key not listed here (the bulk data) is stripped.
 */
const TOOL_KEEP_KEYS: Record<string, string[]> = {
  set_code_cell_value: ['sheet_name', 'code_cell_name', 'code_cell_language', 'code_cell_position'],
  set_sql_code_cell_value: ['sheet_name', 'code_cell_name', 'connection_kind', 'code_cell_position', 'connection_id'],
  set_cell_values: ['sheet_name', 'top_left_position'],
  add_data_table: ['sheet_name', 'top_left_position', 'table_name'],
};

const DEFAULT_KEEP_KEYS = ['sheet_name', 'top_left_position', 'selection', 'table_name', 'language', 'position'];

/**
 * Truncate a tool call's arguments JSON, keeping card-essential metadata
 * and computing summary fields for stripped bulk data.
 * Returns a shortened JSON string.
 */
const compressToolCallArgs = (argsJson: string, toolName: string): string => {
  try {
    const args = JSON.parse(argsJson);
    const compressed: Record<string, unknown> = {};

    // set_formula_cell_value needs special handling for its nested formulas array
    if (toolName === 'set_formula_cell_value' && Array.isArray(args.formulas)) {
      compressed.formulas = args.formulas.map((f: Record<string, unknown>) => ({
        sheet_name: f.sheet_name,
        code_cell_position: f.code_cell_position,
      }));
      compressed._compressed = ARGS_COMPRESSED_MESSAGE;
      return JSON.stringify(compressed);
    }

    const keepKeys = TOOL_KEEP_KEYS[toolName] ?? DEFAULT_KEEP_KEYS;
    for (const key of keepKeys) {
      if (key in args) {
        compressed[key] = args[key];
      }
    }

    // Compute summary fields for stripped bulk data
    if (typeof args.code_string === 'string') {
      compressed.compressed_line_count = args.code_string.split('\n').length;
    }
    if (typeof args.sql_code_string === 'string') {
      compressed.compressed_line_count = args.sql_code_string.split('\n').length;
    }
    if (Array.isArray(args.cell_values)) {
      compressed.compressed_rows = args.cell_values.length;
      compressed.compressed_cols = args.cell_values.reduce(
        (max: number, row: unknown[]) => Math.max(max, Array.isArray(row) ? row.length : 0),
        0
      );
    }
    if (Array.isArray(args.table_data)) {
      compressed.compressed_rows = args.table_data.length;
      compressed.compressed_cols = args.table_data.reduce(
        (max: number, row: unknown[]) => Math.max(max, Array.isArray(row) ? row.length : 0),
        0
      );
    }

    compressed._compressed = ARGS_COMPRESSED_MESSAGE;
    return JSON.stringify(compressed);
  } catch {
    return `{"_compressed": "${ARGS_COMPRESSED_MESSAGE}"}`;
  }
};

/**
 * Compress old tool results and tool call arguments to manage context size.
 *
 * For each compressible tool type, keeps the last N occurrences in full and
 * replaces older ones with a short summary. Also compresses large arguments
 * on assistant messages for tools that send bulk data (code, cell values, etc.).
 *
 * Additionally removes plotly images from all old tool results.
 */
export const compressOldToolResults = (messages: ChatMessage[]): ChatMessage[] => {
  // Build a map: toolCallId -> { toolName, messageIndex (of assistant msg) }
  const toolCallInfo = new Map<string, { toolName: string; assistantMsgIndex: number }>();
  messages.forEach((message, i) => {
    if (message.role === 'assistant' && message.contextType === 'userPrompt') {
      for (const tc of message.toolCalls) {
        toolCallInfo.set(tc.id, { toolName: tc.name, assistantMsgIndex: i });
      }
    }
  });

  // For each compressible tool, find which tool call IDs should be compressed
  // (i.e., all except the last N occurrences)
  const toolOccurrences = new Map<string, string[]>(); // toolName -> [toolCallId, ...]
  // Iterate in order so occurrences are oldest-first
  for (const [id, info] of toolCallInfo) {
    if (!(info.toolName in COMPRESSIBLE_TOOLS)) continue;
    if (!toolOccurrences.has(info.toolName)) {
      toolOccurrences.set(info.toolName, []);
    }
    toolOccurrences.get(info.toolName)!.push(id);
  }

  // Determine which tool call IDs should be compressed
  const compressResultIds = new Set<string>();
  const compressArgsIds = new Set<string>();
  for (const [toolName, ids] of toolOccurrences) {
    const config = COMPRESSIBLE_TOOLS[toolName];
    if (!config) continue;
    const cutoff = ids.length - config.keepLast;
    for (let i = 0; i < cutoff; i++) {
      compressResultIds.add(ids[i]);
      if (config.compressArgs) {
        compressArgsIds.add(ids[i]);
      }
    }
  }

  return messages.map((message) => {
    // Compress tool call arguments on assistant messages
    if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.toolCalls) {
      const hasCompressibleArgs = message.toolCalls.some((tc) => compressArgsIds.has(tc.id));
      if (hasCompressibleArgs) {
        return {
          ...message,
          toolCalls: message.toolCalls.map((tc) => {
            if (compressArgsIds.has(tc.id)) {
              return { ...tc, arguments: compressToolCallArgs(tc.arguments, tc.name) };
            }
            return tc;
          }),
        };
      }
    }

    // Compress tool results on user messages
    if (message.role === 'user' && message.contextType === 'toolResult') {
      return {
        ...message,
        content: message.content.map((toolResult) => {
          if (compressResultIds.has(toolResult.id)) {
            return {
              id: toolResult.id,
              content: [createTextContent(RESULT_COMPRESSED_MESSAGE)],
            };
          }
          // Remove plotly images from tool results that are not compressed
          const content = toolResult.content.filter((c) => !isContentImage(c));
          return {
            id: toolResult.id,
            content: content.length > 0 ? content : [createTextContent(RESULT_COMPRESSED_MESSAGE)],
          };
        }),
      };
    }

    return message;
  });
};
