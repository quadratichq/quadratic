import type { AiMemoryScope } from '@prisma/client';
import type { MemoryRecord } from './memoryService';
import { searchMemories } from './memoryService';

/**
 * Retrieve memories with scope-aware ranking via vector search.
 * Searches both team-scoped and file-scoped memories, then
 * combines and ranks them with scope-based boosts.
 *
 * Priority order:
 * 1. Current file memories (highest)
 * 2. Team patterns (high)
 */
export async function getMemoryContextWithNetwork(args: {
  teamId: number;
  fileId?: number;
  query: string;
  maxMemories?: number;
}): Promise<MemoryRecord[]> {
  const { teamId, fileId, query, maxMemories = 10 } = args;

  // Search team-scoped memories (always relevant)
  const teamMatches = await searchMemories({
    teamId,
    query,
    scope: 'team' as AiMemoryScope,
    limit: 5,
  });

  // Search file-scoped memories for current file
  const fileMatches = fileId
    ? await searchMemories({
        teamId,
        query,
        fileId,
        scope: 'file' as AiMemoryScope,
        limit: 5,
      })
    : [];

  return combineAndRank({
    fileMatches,
    teamMatches,
    maxMemories,
  });
}

const MIN_SIMILARITY = 0.4;

function combineAndRank(args: {
  fileMatches: MemoryRecord[];
  teamMatches: MemoryRecord[];
  maxMemories: number;
}): MemoryRecord[] {
  const scored: Array<{ memory: MemoryRecord; score: number }> = [];

  // Current file: highest priority boost
  for (const m of args.fileMatches) {
    if (m.similarity < MIN_SIMILARITY) continue;
    scored.push({ memory: m, score: m.similarity * 1.5 });
  }

  // Team patterns: high value
  for (const m of args.teamMatches) {
    if (m.similarity < MIN_SIMILARITY) continue;
    scored.push({ memory: m, score: m.similarity * 1.3 });
  }

  // Deduplicate and sort by score
  const seen = new Set<number>();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter(({ memory }) => {
      if (seen.has(memory.id)) return false;
      seen.add(memory.id);
      return true;
    })
    .slice(0, args.maxMemories)
    .map(({ memory }) => memory);
}
