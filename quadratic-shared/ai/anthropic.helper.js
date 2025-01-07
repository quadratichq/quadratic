"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnthropicApiArgs = getAnthropicApiArgs;
const aiToolsSpec_1 = require("quadratic-shared/ai/aiToolsSpec");
const message_helper_1 = require("quadratic-shared/ai/message.helper");
function getAnthropicApiArgs(args) {
    const { messages: chatMessages, useTools, toolName } = args;
    const { systemMessages, promptMessages } = (0, message_helper_1.getSystemPromptMessages)(chatMessages);
    const system = systemMessages.join('\n\n');
    const messages = promptMessages.reduce((acc, message) => {
        if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.toolCalls.length > 0) {
            const anthropicMessages = [
                ...acc,
                {
                    role: message.role,
                    content: [
                        ...(message.content
                            ? [
                                {
                                    type: 'text',
                                    text: message.content,
                                },
                            ]
                            : []),
                        ...message.toolCalls.map((toolCall) => ({
                            type: 'tool_use',
                            id: toolCall.id,
                            name: toolCall.name,
                            input: JSON.parse(toolCall.arguments),
                        })),
                    ],
                },
            ];
            return anthropicMessages;
        }
        else if (message.role === 'user' && message.contextType === 'toolResult') {
            const anthropicMessages = [
                ...acc,
                {
                    role: message.role,
                    content: [
                        ...message.content.map((toolResult) => ({
                            type: 'tool_result',
                            tool_use_id: toolResult.id,
                            content: toolResult.content,
                        })),
                        {
                            type: 'text',
                            text: 'Given the above tool calls results, please provide your final answer to the user.',
                        },
                    ],
                },
            ];
            return anthropicMessages;
        }
        else {
            const anthropicMessages = [
                ...acc,
                {
                    role: message.role,
                    content: message.content,
                },
            ];
            return anthropicMessages;
        }
    }, []);
    const tools = getAnthropicTools(useTools, toolName);
    const tool_choice = getAnthropicToolChoice(useTools, toolName);
    return { system, messages, tools, tool_choice };
}
function getAnthropicTools(useTools, toolName) {
    if (!useTools) {
        return undefined;
    }
    const tools = Object.entries(aiToolsSpec_1.aiToolsSpec).filter(([name, toolSpec]) => {
        if (toolName === undefined) {
            return !toolSpec.internalTool;
        }
        return name === toolName;
    });
    const anthropicTools = tools.map(([name, { description, parameters: input_schema }]) => ({
        name,
        description,
        input_schema,
    }));
    return anthropicTools;
}
function getAnthropicToolChoice(useTools, name) {
    if (!useTools) {
        return undefined;
    }
    const toolChoice = name === undefined ? { type: 'auto' } : { type: 'tool', name };
    return toolChoice;
}
