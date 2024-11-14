import Exa from 'exa-js';
import express from 'express';
import { ExaSearchRequestBodySchema } from 'quadratic-shared/typesAndSchemasAI';
import { EXA_API_KEY } from '../../env-vars';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { ai_rate_limiter } from './aiRateLimiter';

const exa_router = express.Router();

const exa = new Exa(EXA_API_KEY);

exa_router.post('/exa', validateAccessToken, ai_rate_limiter, async (request, response) => {
  try {
    const { query, type, numResults, livecrawl, useAutoprompt, text, highlights, summary } =
      ExaSearchRequestBodySchema.parse(request.body);
    const result = await exa.searchAndContents(query, {
      type,
      numResults,
      livecrawl,
      useAutoprompt,
      text: text ? true : undefined,
      highlights: highlights ? true : undefined,
      summary: summary ? true : undefined,
    });
    response.json(result);
  } catch (error: any) {
    if (error.response) {
      response.status(error.response.status).json(error.response.data);
      console.log(error.response.status, error.response.data);
    } else {
      response.status(400).json(error.message);
      console.log(error.message);
    }
  }
});

export default exa_router;
