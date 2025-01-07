"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBedrockApiArgs = getBedrockApiArgs;
const aiToolsSpec_1 = require("quadratic-shared/ai/aiToolsSpec");
const message_helper_1 = require("./message.helper");
function getBedrockApiArgs(args) {
    const { messages: chatMessages, useTools, toolName } = args;
    const { systemMessages, promptMessages } = (0, message_helper_1.getSystemPromptMessages)(chatMessages);
    const system = systemMessages.map((message) => ({ text: message }));
    const messages = promptMessages.map((message) => {
        if (message.role === 'assistant' && message.contextType === 'userPrompt' && message.toolCalls.length > 0) {
            const bedrockMessage = {
                role: message.role,
                content: [
                    ...(message.content
                        ? [
                            {
                                text: message.content,
                            },
                        ]
                        : []),
                    ...message.toolCalls.map((toolCall) => ({
                        toolUse: {
                            toolUseId: toolCall.id,
                            name: toolCall.name,
                            input: JSON.parse(toolCall.arguments),
                        },
                    })),
                ],
            };
            return bedrockMessage;
        }
        else if (message.role === 'user' && message.contextType === 'toolResult') {
            const bedrockMessage = {
                role: message.role,
                content: [
                    ...message.content.map((toolResult) => ({
                        toolResult: {
                            toolUseId: toolResult.id,
                            content: [
                                {
                                    text: toolResult.content,
                                },
                            ],
                            status: 'success',
                        },
                    })),
                ],
            };
            return bedrockMessage;
        }
        else {
            const bedrockMessage = {
                role: message.role,
                content: [
                    {
                        text: message.content,
                    },
                ],
            };
            return bedrockMessage;
        }
    });
    const tools = getBedrockTools(useTools, toolName);
    const tool_choice = getBedrockToolChoice(useTools, toolName);
    return { system, messages, tools, tool_choice };
}
function getBedrockTools(useTools, toolName) {
    if (!useTools) {
        return undefined;
    }
    const tools = Object.entries(aiToolsSpec_1.aiToolsSpec).filter(([name, toolSpec]) => {
        if (toolName === undefined) {
            return !toolSpec.internalTool;
        }
        return name === toolName;
    });
    const bedrockTools = tools.map(([name, { description, parameters: input_schema }]) => ({
        toolSpec: {
            name,
            description,
            inputSchema: {
                json: input_schema,
            },
        },
    }));
    return bedrockTools;
}
function getBedrockToolChoice(useTools, name) {
    if (!useTools) {
        return undefined;
    }
    const toolChoice = name === undefined ? { auto: {} } : { tool: { name } };
    return toolChoice;
}
