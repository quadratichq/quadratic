"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelOptions = void 0;
exports.isBedrockModel = isBedrockModel;
exports.isAnthropicBedrockModel = isAnthropicBedrockModel;
exports.isAnthropicModel = isAnthropicModel;
exports.isOpenAIModel = isOpenAIModel;
const AI_MODELS_1 = require("quadratic-shared/ai/AI_MODELS");
function isBedrockModel(model) {
    return AI_MODELS_1.MODEL_OPTIONS[model].provider === 'bedrock';
}
function isAnthropicBedrockModel(model) {
    return AI_MODELS_1.MODEL_OPTIONS[model].provider === 'bedrock-anthropic';
}
function isAnthropicModel(model) {
    return AI_MODELS_1.MODEL_OPTIONS[model].provider === 'anthropic';
}
function isOpenAIModel(model) {
    return AI_MODELS_1.MODEL_OPTIONS[model].provider === 'openai';
}
const getModelOptions = (model, args) => {
    const { canStream, canStreamWithToolCalls, temperature, max_tokens } = AI_MODELS_1.MODEL_OPTIONS[model];
    const { useTools, useStream } = args;
    const stream = canStream
        ? useTools
            ? canStreamWithToolCalls && (useStream !== null && useStream !== void 0 ? useStream : canStream)
            : useStream !== null && useStream !== void 0 ? useStream : canStream
        : false;
    return { stream, temperature, max_tokens };
};
exports.getModelOptions = getModelOptions;
