import type { Request, Response } from 'express';
import { z } from 'zod';
import { generateEmbedding } from '../../ai/memory/memoryService';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    id: z.string().transform((v) => parseInt(v, 10)),
  }),
  body: z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
    pinned: z.boolean().optional(),
  }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { uuid, id },
    body: { title, summary, pinned },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req as RequestWithUser;

  const { team, userMakingRequest } = await getTeam({ uuid, userId });

  if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You need edit permissions to modify memories');
  }

  const existing = await dbClient.aiMemory.findFirst({
    where: { id, teamId: team.id },
  });
  if (!existing) {
    throw new ApiError(404, 'Memory not found');
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updateData.title = title;
  if (summary !== undefined) updateData.summary = summary;
  if (pinned !== undefined) updateData.pinned = pinned;

  // Re-generate embedding if summary or title changed
  if (title !== undefined || summary !== undefined) {
    const newTitle = title ?? existing.title;
    const newSummary = summary ?? existing.summary;
    const embedding = await generateEmbedding(`${newTitle}: ${newSummary}`);
    const embeddingStr = `[${embedding.join(',')}]`;

    await dbClient.$executeRaw`
      UPDATE ai_memory
      SET title = ${newTitle},
          summary = ${newSummary},
          embedding = ${embeddingStr}::vector,
          pinned = ${pinned ?? existing.pinned},
          updated_at = NOW()
      WHERE id = ${id} AND team_id = ${team.id}
    `;
  } else {
    await dbClient.aiMemory.update({
      where: { id },
      data: updateData,
    });
  }

  const updated = await dbClient.aiMemory.findUnique({
    where: { id },
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

  return res.status(200).json(updated);
}
