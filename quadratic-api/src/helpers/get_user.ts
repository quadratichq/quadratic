import { Request as JWTRequest } from 'express-jwt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const get_user = async (request: JWTRequest) => {
  return await prisma.qUser.upsert({
    where: {
      auth0_user_id: request.auth?.sub,
    },
    update: {},
    create: {
      auth0_user_id: request.auth?.sub,
    },
  });
};
