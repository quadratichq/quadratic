import type { Request, Response } from 'express';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  query: z.object({
    entityType: z.enum(['FILE', 'CODE_CELL', 'CONNECTION', 'CHAT_INSIGHT']).optional(),
    fileId: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : undefined)),
    cursor: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : undefined)),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? Math.min(parseInt(v, 10), 100) : 50)),
  }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { uuid },
    query: { entityType, fileId, cursor, limit },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req as RequestWithUser;

  const { team } = await getTeam({ uuid, userId });

  const where: Record<string, unknown> = { teamId: team.id };
  if (entityType) where.entityType = entityType;
  if (fileId) where.fileId = fileId;
  if (cursor) where.id = { lt: cursor };

  const memories = await dbClient.aiMemory.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      teamId: true,
      fileId: true,
      entityType: true,
      entityId: true,
      title: true,
      summary: true,
      metadata: true,
      pinned: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const nextCursor = memories.length === limit ? memories[memories.length - 1].id : null;

  return res.status(200).json({ memories, nextCursor });
}
