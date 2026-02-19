import { AIChatSource } from '@prisma/client';
import type { AIModelKey, AISource, AIUsage } from 'quadratic-shared/typesAndSchemasAI';
import { calculateUsage } from '../ai/helpers/usage.helper';
import dbClient from '../dbClient';
import logger from '../utils/logger';

const aiSourceToAIChatSource: Record<AISource, AIChatSource> = {
  AIAssistant: AIChatSource.AIAssistant,
  AIAnalyst: AIChatSource.AIAnalyst,
  AIResearcher: AIChatSource.AIResearcher,
  GetChatName: AIChatSource.GetChatName,
  GetFileName: AIChatSource.GetFileName,
  CodeEditorCompletions: AIChatSource.CodeEditorCompletions,
  GetUserPromptSuggestions: AIChatSource.GetUserPromptSuggestions,
  GetEmptyChatPromptSuggestions: AIChatSource.GetEmptyChatPromptSuggestions,
  PDFImport: AIChatSource.PDFImport,
  ModelRouter: AIChatSource.ModelRouter,
  WebSearch: AIChatSource.WebSearch,
  OptimizePrompt: AIChatSource.OptimizePrompt,
};

export function toAIChatSource(source: AISource): AIChatSource {
  return aiSourceToAIChatSource[source];
}

export interface TrackAICostParams {
  userId: number;
  teamId: number;
  fileId?: number;
  usage: AIUsage;
  modelKey: AIModelKey;
  source: AIChatSource;
  isFreePlan?: boolean;
}

/**
 * Tracks the cost of an AI request in the database.
 * This function is non-blocking - errors are logged but don't throw.
 * Skips tracking for free plan users so their full allowance is
 * available when they subscribe.
 */
export async function trackAICost({
  userId,
  teamId,
  fileId,
  usage,
  modelKey,
  source,
  isFreePlan,
}: TrackAICostParams): Promise<void> {
  if (isFreePlan) return;

  try {
    const cost = calculateUsage({ ...usage, modelKey });

    await dbClient.aICost.create({
      data: {
        userId,
        teamId,
        fileId: fileId ?? null,
        cost,
        model: modelKey,
        source,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
      },
    });
  } catch (error) {
    // Log error but don't throw - cost tracking should not break AI requests
    logger.error('Failed to track AI cost', {
      error,
      userId,
      teamId,
      fileId,
      modelKey,
      source,
    });
  }
}
