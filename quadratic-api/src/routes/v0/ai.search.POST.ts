import type { Response } from 'express';
import { z } from 'zod';
import { ai_rate_limiter } from '../../ai/middleware/aiRateLimiter';
import { PARALLEL_API_KEY } from '../../env-vars';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import logger from '../../utils/logger';

export default [validateAccessToken, ai_rate_limiter, userMiddleware, handler];

const schema = z.object({
  body: z.object({
    query: z.string(),
  }),
});

// Parallel API response schema
const ParallelSearchResultSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  excerpts: z.array(z.string()).optional(),
});

const ParallelSearchResponseSchema = z.object({
  results: z.array(ParallelSearchResultSchema),
});

export type ParallelSearchResult = z.infer<typeof ParallelSearchResultSchema>;

export interface WebSearchResponse {
  query: string;
  results: Array<{
    url: string;
    title: string;
    excerpt: string;
  }>;
}

async function handler(req: RequestWithUser, res: Response<WebSearchResponse>) {
  const { body } = parseRequest(req, schema);
  const { query } = body;

  if (!PARALLEL_API_KEY) {
    throw new ApiError(500, 'PARALLEL_API_KEY is not configured');
  }

  try {
    const response = await fetch('https://api.parallel.ai/v1beta/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PARALLEL_API_KEY,
        'parallel-beta': 'search-extract-2025-10-10',
      },
      body: JSON.stringify({
        objective: query,
        search_queries: [query],
        max_results: 10,
        excerpts: {
          max_chars_per_result: 5000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Parallel search API error', { status: response.status, error: errorText });
      throw new ApiError(response.status, `Search API error: ${errorText}`);
    }

    const data = await response.json();
    const parsed = ParallelSearchResponseSchema.safeParse(data);

    if (!parsed.success) {
      logger.error('Invalid Parallel search response', { error: parsed.error, data });
      throw new ApiError(500, 'Invalid response from search API');
    }

    const webSearchResponse: WebSearchResponse = {
      query,
      results: parsed.data.results.map((result) => ({
        url: result.url,
        title: result.title ?? new URL(result.url).hostname,
        excerpt: result.excerpts?.join('\n\n') ?? '',
      })),
    };

    res.status(200).json(webSearchResponse);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error('Error in ai.search.POST handler', error);
    throw new ApiError(500, 'Failed to perform web search');
  }
}
