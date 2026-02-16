import type { Request, Response } from 'express';
import { z } from 'zod';
import { generateMemories } from '../../ai/memory/memoryService';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

const codeCellSchema = z.object({
  sheetName: z.string(),
  position: z.string(),
  language: z.string(),
  code: z.string(),
  outputShape: z.string().nullable(),
  hasError: z.boolean(),
  stdOut: z.string().nullable(),
  stdErr: z.string().nullable(),
});

const sheetSchema = z.object({
  name: z.string(),
  bounds: z.string().nullable(),
  dataTables: z.array(
    z.object({
      name: z.string(),
      columns: z.array(z.string()),
      bounds: z.string(),
    })
  ),
  codeTables: z.array(
    z.object({
      name: z.string(),
      language: z.string(),
      columns: z.array(z.string()),
      bounds: z.string(),
      code: z.string(),
    })
  ),
  connections: z.array(
    z.object({
      name: z.string(),
      connectionKind: z.string(),
      columns: z.array(z.string()),
      bounds: z.string(),
      code: z.string(),
    })
  ),
  charts: z.array(
    z.object({
      name: z.string(),
      language: z.string(),
      bounds: z.string(),
      code: z.string(),
    })
  ),
});

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: z.object({
    fileUuid: z.string().uuid(),
    payload: z.object({
      sheets: z.array(sheetSchema),
      codeCells: z.array(codeCellSchema),
      sheetTables: z.array(
        z.object({
          sheetName: z.string(),
          bounds: z.string(),
          columns: z.array(z.string()),
          rows: z.number(),
          cols: z.number(),
        })
      ),
    }),
  }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { uuid },
    body: { fileUuid, payload },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req as RequestWithUser;

  const { team, userMakingRequest } = await getTeam({ uuid, userId });

  if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
    return res.status(403).json({ error: { message: 'You need edit permissions to regenerate memories' } });
  }

  const file = await dbClient.file.findUnique({
    where: { uuid: fileUuid },
    select: { id: true, name: true, ownerTeamId: true },
  });
  if (!file || file.ownerTeamId !== team.id) {
    return res.status(404).json({ error: { message: 'File not found in this team' } });
  }

  // Reconcile memories in the background (updates changed, skips unchanged, deletes orphans)
  generateMemories({
    teamId: team.id,
    fileId: file.id,
    fileName: file.name,
    payload,
  }).catch((err) => {
    console.error('[ai-memory] Failed to regenerate memories:', err);
  });

  return res.status(202).json({ message: 'Memory regeneration started' });
}
