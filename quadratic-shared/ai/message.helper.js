"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemPromptMessages = exports.getPromptMessages = exports.getSystemMessages = void 0;
const getSystemMessages = (messages) => {
    const systemMessages = messages.filter((message) => message.role === 'user' && message.contextType !== 'userPrompt' && message.contextType !== 'toolResult');
    return systemMessages.map((message) => message.content);
};
exports.getSystemMessages = getSystemMessages;
const getPromptMessages = (messages) => {
    return messages.filter((message) => message.contextType === 'userPrompt' || message.contextType === 'toolResult');
};
exports.getPromptMessages = getPromptMessages;
const getSystemPromptMessages = (messages) => {
    // send internal context messages as system messages
    const systemMessages = (0, exports.getSystemMessages)(messages);
    const promptMessages = (0, exports.getPromptMessages)(messages);
    // send all messages as prompt messages
    // const systemMessages: string[] = [];
    // const promptMessages = messages;
    return { systemMessages, promptMessages };
};
exports.getSystemPromptMessages = getSystemPromptMessages;
