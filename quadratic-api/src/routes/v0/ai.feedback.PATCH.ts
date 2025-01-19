import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, handler];

const schema = z.object({
  body: ApiSchemas['/v0/ai/feedback.PATCH.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/feedback.PATCH.response']>) {
  const {
    body: { chatId, messageIndex, like },
  } = parseRequest(req, schema);

  const chat = await dbClient.analyticsAIChat.findUniqueOrThrow({
    where: { chatId },
    include: {
      messages: {
        where: {
          messageIndex,
        },
      },
    },
  });
  const message = chat.messages[0];
  if (!message) {
    return res.status(404).json({ message: 'Message not found' });
  }

  await dbClient.analyticsAIChatMessage.update({
    where: {
      id: message.id,
    },
    data: {
      like,
    },
  });

  res.status(200).json({ message: 'Feedback received' });
}
