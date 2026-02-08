import type { Prisma } from '@prisma/client';

const MAX_TREE_DEPTH = 500;

type Db = Pick<Prisma.TransactionClient, '$queryRaw'>;

/**
 * Returns all descendant folder IDs (including the root) using a recursive CTE.
 * More efficient than loading all team folders when the tree is large.
 */
export async function getDescendantFolderIds(db: Db, rootFolderId: number): Promise<number[]> {
  const rows = await db.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id, parent_folder_id, 0 AS depth
      FROM "Folder"
      WHERE id = ${rootFolderId}
      UNION ALL
      SELECT f.id, f.parent_folder_id, d.depth + 1
      FROM "Folder" f
      INNER JOIN descendants d ON f.parent_folder_id = d.id
      WHERE d.depth < ${MAX_TREE_DEPTH - 1}
    )
    SELECT id FROM descendants
  `;
  return rows.map((r) => r.id);
}

/**
 * Returns ancestor folder IDs of the given folder (walking parent_folder_id up to root).
 * Used for circularity checks (e.g. moving a folder into one of its descendants).
 */
export async function getAncestorFolderIds(db: Db, folderId: number): Promise<number[]> {
  const rows = await db.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_folder_id, 0 AS depth
      FROM "Folder"
      WHERE id = (SELECT parent_folder_id FROM "Folder" WHERE id = ${folderId})
      UNION ALL
      SELECT f.id, f.parent_folder_id, a.depth + 1
      FROM "Folder" f
      INNER JOIN ancestors a ON f.id = a.parent_folder_id
      WHERE a.depth < ${MAX_TREE_DEPTH - 1}
    )
    SELECT id FROM ancestors
  `;
  return rows.map((r) => r.id);
}

export interface AncestorFolderRow {
  id: number;
  uuid: string;
  name: string;
}

/**
 * Returns ancestor folders from root to immediate parent (ordered for breadcrumbs).
 * More efficient than loading all team folders when depth is small.
 */
export async function getAncestorFoldersForBreadcrumbs(
  db: Db,
  folderId: number
): Promise<AncestorFolderRow[]> {
  const rows = await db.$queryRaw<({ id: number; uuid: string; name: string; depth: number })[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, uuid, name, parent_folder_id, 0 AS depth
      FROM "Folder"
      WHERE id = (SELECT parent_folder_id FROM "Folder" WHERE id = ${folderId})
      UNION ALL
      SELECT f.id, f.uuid, f.name, f.parent_folder_id, a.depth + 1
      FROM "Folder" f
      INNER JOIN ancestors a ON f.id = a.parent_folder_id
      WHERE a.depth < ${MAX_TREE_DEPTH - 1}
    )
    SELECT id, uuid, name, depth FROM ancestors
    ORDER BY depth DESC
  `;
  return rows.map(({ id, uuid, name }) => ({ id, uuid, name }));
}
