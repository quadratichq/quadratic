import type {
  AIMessagePrompt,
  ChatMessage,
  Content,
  ImageContent,
  PdfFileContent,
  SystemMessage,
  TextContent,
  TextFileContent,
  ToolResultContextType,
  ToolResultMessage,
  UserMessagePrompt,
  UserPromptContextType,
} from 'quadratic-shared/typesAndSchemasAI';

export const getSystemMessages = (messages: ChatMessage[]): string[] => {
  const systemMessages: SystemMessage[] = messages.filter<SystemMessage>(
    (message): message is SystemMessage =>
      message.role === 'user' && message.contextType !== 'userPrompt' && message.contextType !== 'toolResult'
  );
  return systemMessages.flatMap((message) => message.content.map((content) => content.text));
};

export const getPromptMessages = (
  messages: ChatMessage[]
): (UserMessagePrompt | ToolResultMessage | AIMessagePrompt)[] => {
  return messages.filter(
    (message): message is UserMessagePrompt | ToolResultMessage | AIMessagePrompt =>
      message.contextType === 'userPrompt' || message.contextType === 'toolResult'
  );
};

export const getPromptMessagesWithoutPDF = (
  messages: ChatMessage[]
): (UserMessagePrompt | ToolResultMessage | AIMessagePrompt)[] => {
  return getPromptMessages(messages).map((message) => {
    if (message.role !== 'user' || message.contextType === 'toolResult') {
      return message;
    }

    return {
      ...message,
      content: message.content.filter((content) => !isContentPdfFile(content)),
    };
  });
};

export const getUserPromptMessages = (messages: ChatMessage[]): (UserMessagePrompt | ToolResultMessage)[] => {
  return getPromptMessages(messages).filter(
    (message): message is UserMessagePrompt | ToolResultMessage => message.role === 'user'
  );
};

const getAIPromptMessages = (messages: ChatMessage[]): AIMessagePrompt[] => {
  return getPromptMessages(messages).filter((message): message is AIMessagePrompt => message.role === 'assistant');
};

export const getLastPromptMessageType = (messages: ChatMessage[]): UserPromptContextType | ToolResultContextType => {
  const userPromptMessage = getUserPromptMessages(messages);
  return userPromptMessage[userPromptMessage.length - 1].contextType;
};

export const getLastAIPromptMessageIndex = (messages: ChatMessage[]): number => {
  return getAIPromptMessages(messages).length - 1;
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

export const isToolResultMessage = (message: ChatMessage): message is ToolResultMessage => {
  return message.role === 'user' && message.contextType === 'toolResult';
};

export const isContentText = (content: Content[number]): content is TextContent => {
  return content.type === 'text';
};

export const isContentImage = (content: Content[number]): content is ImageContent => {
  return content.type === 'data' && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(content.mimeType);
};

export const isContentPdfFile = (content: Content[number]): content is PdfFileContent => {
  return content.type === 'data' && content.mimeType === 'application/pdf';
};

export const isContentTextFile = (content: Content[number]): content is TextFileContent => {
  return content.type === 'data' && content.mimeType === 'text/plain';
};

export const filterImageFilesInChatMessages = (messages: ChatMessage[]): ImageContent[] => {
  return getUserPromptMessages(messages)
    .filter((message) => message.contextType === 'userPrompt')
    .flatMap((message) => message.content)
    .filter(isContentImage);
};

export const filterPdfFilesInChatMessages = (messages: ChatMessage[]): PdfFileContent[] => {
  return getUserPromptMessages(messages)
    .filter((message) => message.contextType === 'userPrompt')
    .flatMap((message) => message.content)
    .filter(isContentPdfFile);
};

export const getPdfFileFromChatMessages = (fileName: string, messages: ChatMessage[]): PdfFileContent | undefined => {
  return filterPdfFilesInChatMessages(messages).find((content) => content.fileName === fileName);
};

// Cleans up old get_ tool messages to avoid expensive contexts.
export const replaceOldGetToolCallResults = (messages: ChatMessage[]): ChatMessage[] => {
  const CLEAN_UP_MESSAGE =
    'NOTE: the results from this tool call have been removed from the context. If you need to use them, you MUST call the tool again.';

  const get_tool_ids = new Set();
  messages.forEach((message) => {
    if (message.role === 'assistant' && message.contextType === 'userPrompt') {
      message.toolCalls.forEach((toolCall) => {
        if (toolCall.name === 'get_cell_data' || toolCall.name === 'get_text_formats') {
          get_tool_ids.add(toolCall.id);
        }
      });
    }
  });

  // If we have multiple get_cell_data messages, keep only the tool call if it's the last one
  return messages.map((message) => {
    if (message.role === 'user' && message.contextType === 'toolResult') {
      return {
        ...message,
        content: message.content.map((content) => {
          return {
            id: content.id,
            text: get_tool_ids.has(content.id) ? CLEAN_UP_MESSAGE : content.text,
          };
        }),
      };
    } else {
      return message;
    }
  });
};
