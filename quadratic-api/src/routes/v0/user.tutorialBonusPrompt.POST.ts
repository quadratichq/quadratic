import type { Response } from 'express';
import { BONUS_PROMPTS } from 'quadratic-shared/bonusPrompts';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/user/tutorialBonusPrompt.POST.request'],
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/user/tutorialBonusPrompt.POST.response'] | ResponseError>
) {
  const { body } = parseRequest(req, schema);
  const userId = req.user.id;
  const { category } = body;

  const bonusPrompt = BONUS_PROMPTS[category as keyof typeof BONUS_PROMPTS];
  if (!bonusPrompt) {
    throw new ApiError(400, 'Invalid bonus prompt category');
  }

  try {
    // Check if the user has already claimed this bonus
    const existingBonus = await dbClient.tutorialBonusPrompt.findUnique({
      where: {
        userId_category: {
          userId,
          category,
        },
      },
    });

    if (existingBonus) {
      throw new ApiError(400, 'Bonus already claimed for this category');
    }

    // Create the bonus prompt record
    const promptsAwarded = bonusPrompt.prompts;
    const tutorialBonusPrompt = await dbClient.tutorialBonusPrompt.create({
      data: {
        userId,
        category,
        promptsAwarded,
      },
    });

    return res.status(200).json({
      category: tutorialBonusPrompt.category,
      promptsAwarded: tutorialBonusPrompt.promptsAwarded,
      received: true,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to award tutorial bonus prompts', error);
  }
}
