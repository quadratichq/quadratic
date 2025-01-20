import type { ChatMessage, SystemMessage, UserMessagePrompt } from 'quadratic-shared/typesAndSchemasAI';

export const getSystemMessages = (messages: ChatMessage[]): string[] => {
  const systemMessages: SystemMessage[] = messages.filter<SystemMessage>(
    (message): message is SystemMessage =>
      message.role === 'user' && message.contextType !== 'userPrompt' && message.contextType !== 'toolResult'
  );
  return systemMessages.map((message) => message.content);
};

export const getPromptMessages = (messages: ChatMessage[]): ChatMessage[] => {
  return messages.filter((message) => message.contextType === 'userPrompt' || message.contextType === 'toolResult');
};

export const getUserPromptMessages = (messages: ChatMessage[]): UserMessagePrompt[] => {
  return getPromptMessages(messages).filter((message): message is UserMessagePrompt => message.role === 'user');
};

export const getLastUserPromptMessageIndex = (messages: ChatMessage[]): number => {
  return getUserPromptMessages(messages).length - 1;
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
