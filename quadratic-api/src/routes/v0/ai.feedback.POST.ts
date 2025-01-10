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
  body: ApiSchemas['/v0/ai/feedback.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/ai/feedback.POST.response']>) {
  const {
    body: { chatId, model, messageIndex, like },
  } = parseRequest(req, schema);

  const chat = await dbClient.analyticsAIChat.findUniqueOrThrow({
    where: { chatId },
  });

  await dbClient.analyticsAIChatMessage.upsert({
    where: {
      chatId_messageIndex: {
        chatId: chat.id,
        messageIndex,
      },
    },
    update: {
      like,
    },
    create: {
      chat: {
        connect: {
          id: chat.id,
        },
      },
      model,
      messageIndex,
      like,
    },
  });

  res.status(200).json({ message: 'Feedback received' });
}
