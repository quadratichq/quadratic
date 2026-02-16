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
    entityType: z.enum(['FILE', 'CODE_CELL', 'DATA_TABLE', 'SHEET_TABLE', 'CONNECTION', 'CHAT_INSIGHT']).optional(),
    scope: z.enum(['file', 'team']).optional(),
    fileId: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : undefined)),
    fileUuid: z.string().uuid().optional(),
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
    query: { entityType, scope, fileId, fileUuid, cursor, limit },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req as RequestWithUser;

  const { team } = await getTeam({ uuid, userId });

  // Resolve fileUuid to internal fileId if provided
  let resolvedFileId = fileId;
  if (!resolvedFileId && fileUuid) {
    const file = await dbClient.file.findUnique({
      where: { uuid: fileUuid },
      select: { id: true, ownerTeamId: true },
    });
    if (file && file.ownerTeamId === team.id) {
      resolvedFileId = file.id;
    }
  }

  const where: Record<string, unknown> = { teamId: team.id };
  if (entityType) where.entityType = entityType;
  if (scope) where.scope = scope;
  if (resolvedFileId) where.fileId = resolvedFileId;
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
      scope: true,
      topic: true,
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
