"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAIApiArgs = getOpenAIApiArgs;
const aiToolsSpec_1 = require("quadratic-shared/ai/aiToolsSpec");
const message_helper_1 = require("./message.helper");
function getOpenAIApiArgs(args) {
    const { messages: chatMessages, useTools, toolName } = args;
    const { systemMessages, promptMessages } = (0, message_helper_1.getSystemPromptMessages)(chatMessages);
    const messages = promptMessages.reduce((acc, message) => {
        if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.toolCalls.length > 0) {
            const openaiMessages = [
                ...acc,
                {
                    role: message.role,
                    content: message.content,
                    tool_calls: message.toolCalls.map((toolCall) => ({
                        id: toolCall.id,
                        type: 'function',
                        function: {
                            name: toolCall.name,
                            arguments: toolCall.arguments,
                        },
                    })),
                },
            ];
            return openaiMessages;
        }
        else if (message.role === 'user' && message.contextType === 'toolResult') {
            const openaiMessages = [
                ...acc,
                ...message.content.map((toolResult) => ({
                    role: 'tool',
                    tool_call_id: toolResult.id,
                    content: toolResult.content,
                })),
            ];
            return openaiMessages;
        }
        else {
            const openaiMessages = [
                ...acc,
                {
                    role: message.role,
                    content: message.content,
                },
            ];
            return openaiMessages;
        }
    }, []);
    const openaiMessages = [
        { role: 'system', content: systemMessages.map((message) => ({ type: 'text', text: message })) },
        ...messages,
    ];
    const tools = getOpenAITools(useTools, toolName);
    const tool_choice = getOpenAIToolChoice(useTools, toolName);
    return { messages: openaiMessages, tools, tool_choice };
}
function getOpenAITools(useTools, toolName) {
    if (!useTools) {
        return undefined;
    }
    const tools = Object.entries(aiToolsSpec_1.aiToolsSpec).filter(([name, toolSpec]) => {
        if (toolName === undefined) {
            return !toolSpec.internalTool;
        }
        return name === toolName;
    });
    const openaiTools = tools.map(([name, { description, parameters }]) => ({
        type: 'function',
        function: {
            name,
            description,
            parameters,
            strict: true,
        },
    }));
    return openaiTools;
}
function getOpenAIToolChoice(useTools, name) {
    if (!useTools) {
        return undefined;
    }
    const toolChoice = name === undefined ? 'auto' : { type: 'function', function: { name } };
    return toolChoice;
}
