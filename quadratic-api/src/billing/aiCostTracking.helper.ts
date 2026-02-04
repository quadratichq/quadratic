import dbClient from '../dbClient';
import { calculateUsage } from '../ai/helpers/usage.helper';
import type { AIUsage } from 'quadratic-shared/typesAndSchemasAI';
import type { AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import type { AIChatSource } from '@prisma/client';
import logger from '../utils/logger';

export interface TrackAICostParams {
  userId: number;
  teamId: number;
  fileId?: number;
  usage: AIUsage;
  modelKey: AIModelKey;
  source: AIChatSource;
}

/**
 * Tracks the cost of an AI request in the database.
 * This function is non-blocking - errors are logged but don't throw.
 *
 * @param params - Parameters for tracking AI cost
 */
export async function trackAICost({
  userId,
  teamId,
  fileId,
  usage,
  modelKey,
  source,
}: TrackAICostParams): Promise<void> {
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
