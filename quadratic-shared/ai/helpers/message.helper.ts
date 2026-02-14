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
  ToolResult,
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

  // Filter out internal tool calls (e.g., from subagents) from assistant messages
  const messagesWithoutInternalToolCalls = messagesWithoutInternal.map((message) => {
    if (message.role !== 'assistant' || message.contextType !== 'userPrompt' || !message.toolCalls) {
      return message;
    }
    const filteredToolCalls = message.toolCalls.filter((tc) => !tc.internal);
    return { ...message, toolCalls: filteredToolCalls };
  });

  const messagesWithUserContext = messagesWithoutInternalToolCalls.map((message) => {
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

export const isContentText = (
  content: Content[number] | AIResponseContent[number] | ToolResult
): content is TextContent => {
  return 'type' in content && content.type === 'text';
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

// Cleans up old get_ tool messages to avoid expensive contexts.
export const replaceOldGetToolCallResults = (messages: ChatMessage[]): ChatMessage[] => {
  const CLEAN_UP_MESSAGE =
    'NOTE: the results from this tool call have been removed from the context. If you need to use them, you MUST use Python.';

  const getToolIds = new Set();
  messages.forEach((message) => {
    if (message.role === 'assistant' && message.contextType === 'userPrompt') {
      message.toolCalls.forEach((toolCall) => {
        if (toolCall.name === 'get_cell_data' || toolCall.name === 'get_text_formats') {
          getToolIds.add(toolCall.id);
        }
      });
    }
  });

  // If we have multiple get_cell_data messages, keep only the tool call after a
  // certain number of calls
  return messages.map((message, i) => {
    if (message.role === 'user' && message.contextType === 'toolResult') {
      return {
        ...message,
        content: message.content.map((toolResult) => {
          if (getToolIds.has(toolResult.id)) {
            if (i < messages.length - CLEAN_UP_TOOL_CALLS_AFTER) {
              return {
                id: toolResult.id,
                content: [createTextContent(CLEAN_UP_MESSAGE)],
              };
            } else {
              return toolResult;
            }
          } else {
            // clean up plotly images in tool result
            const content = toolResult.content.filter((content) => !isContentImage(content));
            return {
              id: toolResult.id,
              content:
                content.length > 0
                  ? content
                  : [createTextContent('NOTE: the results from this tool call have been removed from the context.')],
            };
          }
        }),
      };
    } else {
      return message;
    }
  });
};
