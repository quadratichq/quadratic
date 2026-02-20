import { Prisma } from '@prisma/client';
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
 * @returns True if the user has exceeded the limit, false otherwise
 */
export const BillingAIUsageLimitExceeded = (monthlyUsage: AIMessageUsage[]) => {
  return BillingAIUsageForCurrentMonth(monthlyUsage) >= (BILLING_AI_USAGE_LIMIT ?? Infinity);
};

/**
 * Gets the AI message usage for multiple users in a team, aggregated by month for the last 6 months.
 * Returns a Map from userId to their monthly usage array (sorted newest first).
 */
export const BillingAIUsageMonthlyForUsersInTeam = async (
  userIds: number[],
  teamId: number
): Promise<Map<number, AIMessageUsage[]>> => {
  if (userIds.length === 0) {
    return new Map();
  }

  const rows = await dbClient.$queryRaw<(AIMessageUsage & { user_id: number })[]>`
WITH date_range AS (
  SELECT
    generate_series(
      DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
      DATE_TRUNC('month', CURRENT_DATE),
      '1 month'::interval
    ) AS month
),
filtered_chats AS (
  SELECT ac.id, ac.user_id, DATE_TRUNC('month', ac.created_date) AS month_date
  FROM "AnalyticsAIChat" ac
  JOIN "File" f ON f.id = ac.file_id AND f.owner_team_id = ${teamId}
  WHERE ac.user_id IN (${Prisma.join(userIds)})
  AND ac.source IN ('ai_assistant', 'ai_analyst', 'ai_researcher')
),
user_list AS (
  SELECT unnest(${userIds}::int[]) AS user_id
)
SELECT
  ul.user_id as user_id,
  TO_CHAR(d.month, 'YYYY-MM') as month,
  COUNT(acm.id)::integer as ai_messages
FROM user_list ul
CROSS JOIN date_range d
LEFT JOIN filtered_chats fc ON fc.month_date = d.month AND fc.user_id = ul.user_id
LEFT JOIN "AnalyticsAIChatMessage" acm ON
  acm.chat_id = fc.id
  AND acm.message_type = 'user_prompt'
GROUP BY ul.user_id, d.month
ORDER BY ul.user_id, d.month DESC;
`;

  const resultMap = new Map<number, AIMessageUsage[]>();
  for (const row of rows) {
    const existing = resultMap.get(row.user_id) ?? [];
    existing.push({ month: row.month, ai_messages: row.ai_messages });
    resultMap.set(row.user_id, existing);
  }
  return resultMap;
};

/**
 * Gets daily AI message usage per user in a team for the current calendar month.
 * Returns flat array of { date, userId, messageCount }.
 */
export const getDailyAiMessagesByUser = async (
  userIds: number[],
  teamId: number
): Promise<Array<{ date: string; userId: number; messageCount: number }>> => {
  if (userIds.length === 0) return [];

  const rows = await dbClient.$queryRaw<Array<{ day: Date; user_id: number; message_count: number }>>`
    SELECT
      DATE_TRUNC('day', ac.created_date) AS day,
      ac.user_id,
      COUNT(acm.id)::integer AS message_count
    FROM "AnalyticsAIChat" ac
    JOIN "File" f ON f.id = ac.file_id AND f.owner_team_id = ${teamId}
    JOIN "AnalyticsAIChatMessage" acm ON acm.chat_id = ac.id AND acm.message_type = 'user_prompt'
    WHERE ac.user_id IN (${Prisma.join(userIds)})
      AND ac.source IN ('ai_assistant', 'ai_analyst', 'ai_researcher')
      AND ac.created_date >= DATE_TRUNC('month', CURRENT_DATE)
      AND ac.created_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    GROUP BY DATE_TRUNC('day', ac.created_date), ac.user_id
    ORDER BY day, ac.user_id
  `;

  return rows.map((row) => ({
    date: row.day.toISOString().split('T')[0],
    userId: row.user_id,
    messageCount: row.message_count,
  }));
};

/**
 * Gets the total AI message usage for all users in a team within a date range.
 */
export const getBillingPeriodAiMessagesForTeam = async (teamId: number, start: Date, end: Date): Promise<number> => {
  const result = await dbClient.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(acm.id)::bigint as count
    FROM "AnalyticsAIChatMessage" acm
    JOIN "AnalyticsAIChat" ac ON ac.id = acm.chat_id
    JOIN "File" f ON f.id = ac.file_id AND f.owner_team_id = ${teamId}
    WHERE ac.created_date >= ${start}
    AND ac.created_date <= ${end}
    AND ac.source IN ('ai_assistant', 'ai_analyst', 'ai_researcher')
    AND acm.message_type = 'user_prompt'
  `;

  return Number(result[0]?.count ?? 0);
};
