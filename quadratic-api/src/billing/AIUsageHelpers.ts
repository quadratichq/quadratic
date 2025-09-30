import { getExperimentAIMsgCountLimit } from 'quadratic-shared/experiments/getExperimentAIMsgCountLimit';
import dbClient from '../dbClient';

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
 * @returns True if the user has exceeded the limit, false otherwise
 */
export const BillingAIUsageLimitExceeded = async (monthlyUsage: AIMessageUsage[], teamUuid: string) => {
  const { value } = await getExperimentAIMsgCountLimit(teamUuid);
  console.log('BILLING_AI_USAGE_LIMIT', value);
  return BillingAIUsageForCurrentMonth(monthlyUsage) >= (value ?? Infinity);
};
