import type { Response } from 'express';
import { BONUS_PROMPTS } from 'quadratic-shared/bonusPrompts';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/user/tutorialBonusPrompt.GET.response'] | ResponseError>
) {
  const userId = req.user.id;

  try {
    // Get all bonus prompts the user has received
    const userBonusPrompts = await dbClient.tutorialBonusPrompt.findMany({
      where: {
        userId,
      },
    });

    // Create a map of categories the user has received
    const receivedCategories = new Set(userBonusPrompts.map((bonus) => bonus.category));

    const bonusPrompts = [];

    // Add all received prompts (even if no longer active)
    for (const received of userBonusPrompts) {
      const bonusPrompt = BONUS_PROMPTS[received.category as keyof typeof BONUS_PROMPTS];
      bonusPrompts.push({
        category: received.category,
        name: bonusPrompt?.name || received.category,
        prompts: bonusPrompt?.prompts || received.promptsAwarded,
        received: true,
        active: bonusPrompt?.active || false,
      });
    }

    // Add all active prompts the user hasn't received yet
    for (const [category, prompt] of Object.entries(BONUS_PROMPTS)) {
      if (prompt.active && !receivedCategories.has(category)) {
        bonusPrompts.push({
          category,
          name: prompt.name,
          prompts: prompt.prompts,
          received: false,
          active: true,
        });
      }
    }

    // Sort: active ones in BONUS_PROMPTS order, then inactive ones
    const bonusPromptsOrder = Object.keys(BONUS_PROMPTS);
    bonusPrompts.sort((a, b) => {
      // First, sort by active status (active first)
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }

      // Within the same active status, sort by BONUS_PROMPTS order
      const aIndex = bonusPromptsOrder.indexOf(a.category);
      const bIndex = bonusPromptsOrder.indexOf(b.category);

      // If both are in BONUS_PROMPTS, sort by their position
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If only one is in BONUS_PROMPTS, it comes first
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // If neither is in BONUS_PROMPTS, maintain current order
      return 0;
    });

    return res.status(200).json({
      bonusPrompts,
    });
  } catch (error) {
    throw new ApiError(500, 'Failed to fetch tutorial bonus prompts', error);
  }
}
