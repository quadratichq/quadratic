import type { AiMemoryEntityType } from '@prisma/client';
import dbClient from '../../dbClient';
import { generateEmbedding } from './memoryService';

/**
 * Staleness detection: find memories whose associated file has been updated
 * more recently than the memory itself.
 */
export async function findStaleMemories(teamId: number): Promise<
  Array<{
    memoryId: number;
    fileId: number;
    entityType: AiMemoryEntityType;
    memoryUpdatedAt: Date;
    fileUpdatedAt: Date;
  }>
> {
  const staleMemories = await dbClient.$queryRaw<
    Array<{
      memory_id: number;
      file_id: number;
      entity_type: AiMemoryEntityType;
      memory_updated_at: Date;
      file_updated_at: Date;
    }>
  >`
    SELECT
      m.id as memory_id,
      m.file_id,
      m.entity_type,
      m.updated_at as memory_updated_at,
      f.updated_date as file_updated_at
    FROM ai_memory m
    JOIN "File" f ON m.file_id = f.id
    WHERE m.team_id = ${teamId}
      AND m.file_id IS NOT NULL
      AND f.updated_date > m.updated_at
    ORDER BY f.updated_date DESC
    LIMIT 100
  `;

  return staleMemories.map((r) => ({
    memoryId: r.memory_id,
    fileId: r.file_id,
    entityType: r.entity_type,
    memoryUpdatedAt: r.memory_updated_at,
    fileUpdatedAt: r.file_updated_at,
  }));
}

/**
 * Cross-file relationship detection: find files within a team that share
 * similar content by comparing their memory embeddings.
 */
export async function findRelatedFiles(
  teamId: number,
  fileId: number,
  limit: number = 5
): Promise<
  Array<{
    relatedFileId: number;
    relatedFileName: string;
    similarity: number;
  }>
> {
  const results = await dbClient.$queryRaw<
    Array<{
      related_file_id: number;
      related_file_name: string;
      similarity: number;
    }>
  >`
    SELECT
      m2.file_id as related_file_id,
      f.name as related_file_name,
      1 - (m1.embedding <=> m2.embedding) as similarity
    FROM ai_memory m1
    JOIN ai_memory m2 ON m1.team_id = m2.team_id
      AND m1.file_id != m2.file_id
      AND m2.entity_type = 'FILE'
      AND m2.embedding IS NOT NULL
    JOIN "File" f ON m2.file_id = f.id
    WHERE m1.team_id = ${teamId}
      AND m1.file_id = ${fileId}
      AND m1.entity_type = 'FILE'
      AND m1.embedding IS NOT NULL
    ORDER BY m1.embedding <=> m2.embedding
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    relatedFileId: r.related_file_id,
    relatedFileName: r.related_file_name,
    similarity: r.similarity,
  }));
}

/**
 * Prune old, low-quality memories. Removes memories that:
 * - Are not pinned
 * - Have not been updated in over 90 days
 * - Have version 1 (never been re-summarized, likely outdated)
 */
export async function pruneStaleMemories(teamId: number, maxAgeDays: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  const result = await dbClient.aiMemory.deleteMany({
    where: {
      teamId,
      pinned: false,
      version: 1,
      updatedAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

/**
 * Find duplicate or near-duplicate memories within a team.
 * Uses embedding similarity to detect memories with very high overlap.
 */
export async function findDuplicateMemories(
  teamId: number,
  similarityThreshold: number = 0.95
): Promise<
  Array<{
    memoryId1: number;
    memoryId2: number;
    title1: string;
    title2: string;
    similarity: number;
  }>
> {
  const results = await dbClient.$queryRaw<
    Array<{
      id1: number;
      id2: number;
      title1: string;
      title2: string;
      similarity: number;
    }>
  >`
    SELECT
      m1.id as id1,
      m2.id as id2,
      m1.title as title1,
      m2.title as title2,
      1 - (m1.embedding <=> m2.embedding) as similarity
    FROM ai_memory m1
    JOIN ai_memory m2 ON m1.team_id = m2.team_id
      AND m1.id < m2.id
      AND m1.embedding IS NOT NULL
      AND m2.embedding IS NOT NULL
    WHERE m1.team_id = ${teamId}
      AND 1 - (m1.embedding <=> m2.embedding) > ${similarityThreshold}
    ORDER BY similarity DESC
    LIMIT 50
  `;

  return results.map((r) => ({
    memoryId1: r.id1,
    memoryId2: r.id2,
    title1: r.title1,
    title2: r.title2,
    similarity: r.similarity,
  }));
}
