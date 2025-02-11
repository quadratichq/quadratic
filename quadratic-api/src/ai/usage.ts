import dbClient from '../dbClient';

// Get AI message usage aggregated by month for last 6 months
export const getAIMessageUsageForUser = async (userId: number) => {
  return await dbClient.$queryRaw<{ month: string; ai_messages: number }[]>`
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
  ORDER BY m.month ASC;
`;
};
