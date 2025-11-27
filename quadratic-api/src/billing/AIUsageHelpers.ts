import dbClient from '../dbClient';
import { BILLING_AI_USAGE_LIMIT } from '../env-vars';

type AIMessageUsage = {
  month: string;
  ai_messages: number;
};

/**
 * Gets the AI message usage for a user, aggregated by month for the last 6 months
 * @param userId The ID of the user to get the usage for
 * @returns An array of monthly AI message usage, sorted by most recent month first (newest first)
 * @example
 * [
 *   { month: '2024-01', ai_messages: 100 },
 *   { month: '2024-02', ai_messages: 200 },
 *   { month: '2024-03', ai_messages: 300 },
 * ]
 */
export const BillingAIUsageMonthlyForUserInTeam = async (userId: number, teamId: number) => {
  return await dbClient.$queryRaw<AIMessageUsage[]>`
WITH date_range AS (
  SELECT
    generate_series(
      DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
      DATE_TRUNC('month', CURRENT_DATE),
      '1 month'::interval
    ) AS month
),
filtered_chats AS (
  SELECT ac.id, DATE_TRUNC('month', ac.created_date) AS month_date
  FROM "AnalyticsAIChat" ac
  JOIN "File" f ON f.id = ac.file_id AND f.owner_team_id = ${teamId}
  WHERE ac.user_id = ${userId}
  AND ac.source IN ('ai_assistant', 'ai_analyst', 'ai_researcher')
)
SELECT
  TO_CHAR(d.month, 'YYYY-MM') as month,
  COUNT(acm.id)::integer as ai_messages
FROM date_range d
LEFT JOIN filtered_chats fc ON fc.month_date = d.month
LEFT JOIN "AnalyticsAIChatMessage" acm ON
  acm.chat_id = fc.id
  AND acm.message_type = 'user_prompt'
GROUP BY d.month
ORDER BY d.month DESC;
`;
};

/**
 * Gets the AI message usage count for the current month
 * @param monthlyUsage Array of monthly AI message usage, sorted by most recent month first
 * @returns The number of AI messages used in the current month, or undefined if no usage data exists
 */
export const BillingAIUsageForCurrentMonth = (monthlyUsage: AIMessageUsage[]) => {
  return monthlyUsage[0]?.ai_messages;
};

/**
 * Checks if the user has exceeded the AI message usage limit
 * @param monthlyUsage Array of monthly AI message usage, sorted by most recent month first
 * @returns The number of messages exceeded by (0 if not exceeded)
 */
export const BillingAIUsageLimitExceeded = (monthlyUsage: AIMessageUsage[]): number => {
  const currentUsage = BillingAIUsageForCurrentMonth(monthlyUsage) ?? 0;
  const limit = BILLING_AI_USAGE_LIMIT ?? Infinity;
  const exceeded = currentUsage - limit;
  return exceeded > 0 ? exceeded : 0;
};

/**
 * Gets the total bonus prompts awarded to a user
 * @param userId The ID of the user to get bonus prompts for
 * @returns The total number of bonus prompts awarded
 */
export const getTotalBonusPromptsAwarded = async (userId: number): Promise<number> => {
  const bonusPrompts = await dbClient.tutorialBonusPrompt.findMany({
    where: {
      userId,
    },
  });

  return bonusPrompts.reduce((total: number, prompt: any) => total + prompt.promptsAwarded, 0);
};

/**
 * Gets the remaining bonus prompts for a user in a team context
 * @param userId The ID of the user to get bonus prompts for
 * @returns The number of bonus prompts remaining
 */
export const getBonusPromptsRemaining = async (userId: number): Promise<number> => {
  const user = await dbClient.user.findUnique({
    where: { id: userId },
    select: { usedBonusPrompts: true },
  });

  const totalAwarded = await getTotalBonusPromptsAwarded(userId);
  const used = user?.usedBonusPrompts ?? 0;

  return Math.max(0, totalAwarded - used);
};

/**
 * Consumes a bonus prompt for a user by incrementing their used_bonus_prompts counter
 * @param userId The ID of the user consuming a bonus prompt
 * @returns The updated user object with the incremented counter
 */
export const consumeBonusPrompt = async (userId: number, amount: number) => {
  return await dbClient.user.update({
    where: { id: userId },
    data: { usedBonusPrompts: { increment: amount } },
  });
};
