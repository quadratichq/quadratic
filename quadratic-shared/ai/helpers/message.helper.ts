import type {
  AIMessagePrompt,
  AIModelKey,
  AIResponseContent,
  ChatMessage,
  Content,
  GoogleSearchContent,
  GoogleSearchGroundingMetadata,
  ImageContent,
  InternalMessage,
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

const getPromptMessagesWithoutPDF = (
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

export const getPromptMessagesForAI = (
  messages: ChatMessage[]
): (UserMessagePrompt | ToolResultMessage | AIMessagePrompt)[] => {
  return getPromptMessagesWithoutPDF(messages);
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

export const getUserPromptMessages = (messages: ChatMessage[]): (UserMessagePrompt | ToolResultMessage)[] => {
  return getPromptMessages(messages).filter(
    (message): message is UserMessagePrompt | ToolResultMessage => message.role === 'user'
  );
};

const getAIPromptMessages = (messages: ChatMessage[]): AIMessagePrompt[] => {
  return getPromptMessages(messages).filter((message): message is AIMessagePrompt => message.role === 'assistant');
};

export const getLastUserMessageType = (messages: ChatMessage[]): UserPromptContextType | ToolResultContextType => {
  const userPromptMessage = getUserPromptMessages(messages);
  return userPromptMessage[userPromptMessage.length - 1].contextType;
};

export const getLastAIPromptMessageIndex = (messages: ChatMessage[]): number => {
  return getAIPromptMessages(messages).length - 1;
};

export const getLastAIPromptMessageModelKey = (messages: ChatMessage[]): AIModelKey | undefined => {
  const aiPromptMessages = getAIPromptMessages(messages);
  for (let i = aiPromptMessages.length - 1; i >= 0; i--) {
    const message = aiPromptMessages[i];
    if (!!message.modelKey && !isQuadraticModel(message.modelKey)) {
      return message.modelKey;
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

export const isToolResultMessage = (message: ChatMessage): message is ToolResultMessage => {
  return message.role === 'user' && message.contextType === 'toolResult';
};

export const isInternalMessage = (message: ChatMessage): message is InternalMessage => {
  return message.role === 'internal';
};

export const isContentText = (content: Content[number] | AIResponseContent[number]): content is TextContent => {
  return content.type === 'text';
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

export const isContentGoogleSearchInternal = (content: InternalMessage['content']): content is GoogleSearchContent => {
  return content.source === 'google_search';
};

export const isContentGoogleSearchGroundingMetadata = (
  content: Content[number] | AIResponseContent[number]
): content is GoogleSearchGroundingMetadata => {
  return content.type === 'google_search_grounding_metadata';
};

export const isContentFile = (
  content: Content[number] | AIResponseContent[number]
): content is ImageContent | PdfFileContent | TextFileContent => {
  return isContentImage(content) || isContentPdfFile(content) || isContentTextFile(content);
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
    'NOTE: the results from this tool call have been removed from the context. If you need to use them, you MUST use Python.';
  const CLEAN_UP_AFTER = 3;

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
    if (i < messages.length - CLEAN_UP_AFTER && message.role === 'user' && message.contextType === 'toolResult') {
      return {
        ...message,
        content: message.content.map((content) => {
          if (getToolIds.has(content.id)) {
            return {
              id: content.id,
              content: [
                {
                  type: 'text' as const,
                  text: CLEAN_UP_MESSAGE,
                },
              ],
            };
          } else {
            return content;
          }
        }),
      };
    } else {
      return message;
    }
  });
};
