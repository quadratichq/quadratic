import { AIChatSource } from '@prisma/client';
import type { AIModelKey, AISource, AIUsage } from 'quadratic-shared/typesAndSchemasAI';
import { calculateUsage } from '../ai/helpers/usage.helper';
import dbClient from '../dbClient';
import { reportUsageToStripe } from '../stripe/stripe';
import logger from '../utils/logger';
import { getBillingPeriodAiCostForTeam, getBillingPeriodDates, getTeamMonthlyAiAllowance } from './planHelpers';

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
  overageEnabled?: boolean;
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
  overageEnabled,
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
        overageEnabled: overageEnabled ?? false,
      },
    });

    await reportAndTrackOverage(teamId);
  } catch (error) {
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

/**
 * Calculates unbilled overage for a team and reports it to Stripe.
 *
 * Uses a row-level lock (SELECT ... FOR UPDATE) so concurrent calls are
 * serialized. The DB is updated before the Stripe call: if Stripe fails
 * we under-bill (safe direction) rather than double-bill.
 */
export async function reportAndTrackOverage(teamId: number): Promise<void> {
  const team = await dbClient.team.findUnique({ where: { id: teamId } });
  if (!team?.allowOveragePayments || !team.stripeOverageItemId || !team.stripeCustomerId) return;

  let centsToReport = 0;
  const stripeCustomerId = team.stripeCustomerId;

  try {
    centsToReport = await dbClient.$transaction(async (tx) => {
      // Lock the team row to prevent concurrent overage calculations
      await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;

      // Re-read with Prisma to get properly typed camelCase properties
      const lockedTeam = await tx.team.findUnique({ where: { id: teamId } });
      if (!lockedTeam) return 0;

      const { start, end } = getBillingPeriodDates(lockedTeam);
      const [teamAllowance, totalTeamCost] = await Promise.all([
        getTeamMonthlyAiAllowance(lockedTeam),
        getBillingPeriodAiCostForTeam(teamId, start, end),
      ]);

      const totalOverageCents = Math.round(Math.max(0, totalTeamCost - teamAllowance) * 100);

      // Determine already-billed cents (resets on new billing period)
      const alreadyBilledCents =
        lockedTeam.stripeOverageBilledPeriodStart?.getTime() === start.getTime()
          ? lockedTeam.stripeOverageBilledCents
          : 0;

      const delta = totalOverageCents - alreadyBilledCents;
      if (delta <= 0) return 0;

      // Update billed tracking before calling Stripe (safe direction)
      await tx.team.update({
        where: { id: teamId },
        data: {
          stripeOverageBilledCents: totalOverageCents,
          stripeOverageBilledPeriodStart: start,
        },
      });

      return delta;
    });
  } catch (error) {
    logger.error('Failed to calculate overage for Stripe reporting', {
      error: error instanceof Error ? error.message : String(error),
      teamId,
    });
    return;
  }

  if (centsToReport <= 0) return;

  try {
    await reportUsageToStripe(stripeCustomerId, centsToReport);
  } catch (error) {
    logger.error('Failed to report overage to Stripe (billed tracking already updated)', {
      error: error instanceof Error ? error.message : String(error),
      teamId,
      centsToReport,
    });
  }
}
