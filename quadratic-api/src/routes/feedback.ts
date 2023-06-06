import express from 'express';
import { z } from 'zod';
import { Request as JWTRequest } from 'express-jwt';
import { PrismaClient } from '@prisma/client';
import { validateAccessToken } from '../middleware/auth';
import { get_user } from '../helpers/get_user';

const files_router = express.Router();
const prisma = new PrismaClient();

const RequestBodySchema = z.object({
  feedback: z.string(),
});
type RequestBody = z.infer<typeof RequestBodySchema>;

files_router.post('/', validateAccessToken, async (request: JWTRequest, response) => {
  const { feedback }: RequestBody = RequestBodySchema.parse(request.body);
  const user = await get_user(request);

  await prisma.qFeedback.create({
    data: {
      feedback,
      qUserId: user.id,
      created_date: new Date(),
    },
  });

  response.status(200).end();
});

export default files_router;
