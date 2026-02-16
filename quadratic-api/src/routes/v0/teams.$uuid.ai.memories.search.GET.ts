import type { Request, Response } from 'express';
import { z } from 'zod';
import { searchMemories } from '../../ai/memory/memoryService';
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
    q: z.string().min(1),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 10)),
    entityType: z.enum(['FILE', 'CODE_CELL', 'DATA_TABLE', 'SHEET_TABLE', 'CONNECTION', 'CHAT_INSIGHT']).optional(),
    scope: z.enum(['file', 'team']).optional(),
    fileId: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : undefined)),
  }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { uuid },
    query: { q, limit, entityType, scope, fileId },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req as RequestWithUser;

  const { team } = await getTeam({ uuid, userId });

  const results = await searchMemories({
    teamId: team.id,
    query: q,
    limit,
    entityType: entityType as
      | 'FILE'
      | 'CODE_CELL'
      | 'DATA_TABLE'
      | 'SHEET_TABLE'
      | 'CONNECTION'
      | 'CHAT_INSIGHT'
      | undefined,
    scope: scope as 'file' | 'team' | undefined,
    fileId,
  });

  return res.status(200).json({ memories: results });
}
