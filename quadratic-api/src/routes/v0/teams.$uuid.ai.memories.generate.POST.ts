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

  const { team } = await getTeam({ uuid, userId });

  // Look up the file to get its internal id and name
  const file = await dbClient.file.findUnique({
    where: { uuid: fileUuid },
    select: { id: true, name: true, ownerTeamId: true },
  });
  if (!file || file.ownerTeamId !== team.id) {
    return res.status(404).json({ error: { message: 'File not found in this team' } });
  }

  // Run generation in the background so the client doesn't block
  generateMemories({
    teamId: team.id,
    fileId: file.id,
    fileName: file.name,
    payload,
  }).catch((err) => {
    console.error('[ai-memory] Failed to generate memories:', err);
  });

  return res.status(202).json({ message: 'Memory generation started' });
}
