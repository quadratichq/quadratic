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
export const BillingAIUsageMonthlyForUser = async (userId: number) => {
  return await dbClient.$queryRaw<AIMessageUsage[]>`
  WITH RECURSIVE months AS (
    SELECT 
      DATE_TRUNC('month', CURRENT_DATE) as month
    UNION ALL
    SELECT 
      DATE_TRUNC('month', month - INTERVAL '1 month')
    FROM months
    WHERE month > DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
  )
  SELECT 
    TO_CHAR(m.month, 'YYYY-MM') as month,
    COALESCE(COUNT(acm.id)::integer, 0) as ai_messages
  FROM months m
  LEFT JOIN "AnalyticsAIChat" ac ON 
    DATE_TRUNC('month', ac.created_date) = m.month
    AND ac.user_id = ${userId}
    AND ac.source IN ('ai_assistant', 'ai_analyst', 'ai_researcher')
  LEFT JOIN "AnalyticsAIChatMessage" acm ON 
    acm.chat_id = ac.id
    AND acm.message_type = 'user_prompt'
  GROUP BY m.month
  ORDER BY m.month DESC;
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
export const BillingAIUsageLimitExceeded = (monthlyUsage: AIMessageUsage[]) => {
  return BillingAIUsageForCurrentMonth(monthlyUsage) > (BILLING_AI_USAGE_LIMIT ?? Infinity);
};
