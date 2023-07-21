import { Request as JWTRequest } from 'express-jwt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const get_user = async (request: JWTRequest) => {
  if (request.auth?.sub === undefined) throw new Error('No auth0 sub found in request');
  return await prisma.user.upsert({
    where: {
      auth0_id: request.auth.sub,
    },
    update: {},
    create: {
      auth0_id: request.auth.sub,
    },
  });
};
