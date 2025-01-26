import Exa from 'exa-js';
import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { ai_rate_limiter } from '../../ai/middleware/aiRateLimiter';
import { EXA_API_KEY } from '../../env-vars';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, ai_rate_limiter, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/exa.POST.request'],
});

const exa = new Exa(EXA_API_KEY);

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/exa.POST.response']>) {
  try {
    const { body } = parseRequest(req, schema);
    const result = await exa.searchAndContents(body.query, {
      type: body.type,
      numResults: body.numResults,
      livecrawl: body.livecrawl,
      useAutoprompt: body.useAutoprompt,
      text: body.text ? true : undefined,
      highlights: body.highlights ? true : undefined,
      summary: body.summary ? true : undefined,
      categories: body.categories ? body.categories : undefined,
      includeText: body.includeText.length > 0 ? body.includeText : undefined,
      excludeText: body.excludeText.length > 0 ? body.excludeText : undefined,
      includeDomains: body.includeDomains.length > 0 ? body.includeDomains : undefined,
      excludeDomains: body.excludeDomains.length > 0 ? body.excludeDomains : undefined,
      startPublishedDate: body.startPublishedDate ? body.startPublishedDate : undefined,
      endPublishedDate: body.endPublishedDate ? body.endPublishedDate : undefined,
    });
    res.json(result);
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
      console.log(error.response.status, error.response.data);
    } else {
      res.status(400).json(error.message);
      console.log(error.message);
    }
  }
}
