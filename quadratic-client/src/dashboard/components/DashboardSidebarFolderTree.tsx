import { useDropTarget } from '@/dashboard/hooks/useFolderDragDrop';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ChevronRightIcon, FolderIcon, FolderOpenIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigation, useParams } from 'react-router';

interface FolderTreeNode {
  uuid: string;
  name: string;
  ownerUserId: number | null;
  parentFolderUuid: string | null;
  children: FolderTreeNode[];
}

function buildFolderTree(
  folders: Array<{ uuid: string; name: string; ownerUserId: number | null; parentFolderUuid: string | null }>,
  filter: 'team' | 'private'
): FolderTreeNode[] {
  const nodeMap = new Map<string, FolderTreeNode>();

  for (const folder of folders) {
    nodeMap.set(folder.uuid, {
      uuid: folder.uuid,
      name: folder.name,
      ownerUserId: folder.ownerUserId,
      parentFolderUuid: folder.parentFolderUuid,
      children: [],
    });
  }

  const roots: FolderTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentFolderUuid && nodeMap.has(node.parentFolderUuid)) {
      nodeMap.get(node.parentFolderUuid)!.children.push(node);
    } else {
      const isPrivate = node.ownerUserId !== null;
      if ((filter === 'private' && isPrivate) || (filter === 'team' && !isPrivate)) {
        roots.push(node);
      }
    }
  }

  const sortChildren = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

/**
 * Build the set of folder UUIDs that should be auto-expanded
 * because they are ancestors of the currently selected folder.
 */
function getAutoExpandedUuids(
  folders: Array<{ uuid: string; parentFolderUuid: string | null }>,
  activeFolderUuid: string | undefined
): Set<string> {
  const expanded = new Set<string>();
  if (!activeFolderUuid) return expanded;

  const parentMap = new Map<string, string | null>();
  for (const folder of folders) {
    parentMap.set(folder.uuid, folder.parentFolderUuid);
  }

  // Walk up from the active folder, marking each as expanded
  let current: string | null | undefined = activeFolderUuid;
  while (current && parentMap.has(current)) {
    expanded.add(current);
    current = parentMap.get(current);
  }

  return expanded;
}

export function DashboardSidebarFolderTree({ teamUuid, filter }: { teamUuid: string; filter: 'team' | 'private' }) {
  const {
    activeTeam: { folders },
  } = useDashboardRouteLoaderData();
  const params = useParams<{ folderUuid?: string }>();
  const location = useLocation();

  const activeFolderUuid = params.folderUuid;

  const isOnTeamDrive = location.pathname.includes('/drive/team');
  const isOnPrivateDrive = location.pathname.includes('/drive/private');

  const activeFolderBelongsToFilter = useMemo(() => {
    if (!activeFolderUuid) return false;
    const activeFolder = folders.find((f) => f.uuid === activeFolderUuid);
    if (!activeFolder) return false;

    let current = activeFolder;
    while (current.parentFolderUuid) {
      const parentUuid = current.parentFolderUuid;
      const parent = folders.find((f) => f.uuid === parentUuid);
      if (!parent) break;
      current = parent;
    }
    const isPrivate = current.ownerUserId !== null;
    return (filter === 'private' && isPrivate) || (filter === 'team' && !isPrivate);
  }, [activeFolderUuid, folders, filter]);

  const isRelevantView =
    (filter === 'team' && isOnTeamDrive) || (filter === 'private' && isOnPrivateDrive) || activeFolderBelongsToFilter;

  const tree = useMemo(() => buildFolderTree(folders, filter), [folders, filter]);
  const autoExpandedUuids = useMemo(() => getAutoExpandedUuids(folders, activeFolderUuid), [folders, activeFolderUuid]);

  if (!isRelevantView || tree.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <FolderTreeItem
          key={node.uuid}
          node={node}
          teamUuid={teamUuid}
          depth={0}
          autoExpandedUuids={autoExpandedUuids}
        />
      ))}
    </div>
  );
}

function FolderTreeItem({
  node,
  teamUuid,
  depth,
  autoExpandedUuids,
}: {
  node: FolderTreeNode;
  teamUuid: string;
  depth: number;
  autoExpandedUuids: Set<string>;
}) {
  const [isManuallyExpanded, setIsManuallyExpanded] = useState<boolean | null>(null);
  const { isOver: isDropTarget, onDragOver, onDragLeave, onDrop } = useDropTarget(node.uuid);
  const location = useLocation();
  const navigation = useNavigation();
  const to = ROUTES.TEAM_DRIVE_FOLDER(teamUuid, node.uuid);
  const hasChildren = node.children.length > 0;

  const nextLocation = navigation.location;
  const isActive =
    (to === location.pathname && navigation.state !== 'loading') ||
    (nextLocation !== undefined && to === nextLocation.pathname);

  // Auto-expand takes effect, but manual toggle overrides it
  const isAutoExpanded = autoExpandedUuids.has(node.uuid);
  const isExpanded = isManuallyExpanded !== null ? isManuallyExpanded : isAutoExpanded;
  const showChildren = isExpanded && hasChildren;

  // Reset manual override when the auto-expand state changes (navigation)
  useEffect(() => {
    setIsManuallyExpanded(null);
  }, [isAutoExpanded]);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-0.5 rounded px-1.5 py-1 text-sm no-underline transition-colors',
          'hover:bg-accent/50',
          isActive && 'bg-accent brightness-95 saturate-150 dark:brightness-125 dark:saturate-100',
          isDropTarget && 'border border-primary bg-primary/10'
        )}
        style={{ paddingLeft: `${depth * 8 + 14}px` }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <button
          className={cn(
            'flex shrink-0 items-center justify-center rounded p-0.5 hover:bg-accent',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsManuallyExpanded(!isExpanded);
          }}
        >
          <ChevronRightIcon className={cn('text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
        </button>
        <NavLink to={to} className="flex min-w-0 flex-grow items-center gap-1.5 no-underline">
          {showChildren ? (
            <FolderOpenIcon className="shrink-0 text-muted-foreground" />
          ) : (
            <FolderIcon className="shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{node.name}</span>
        </NavLink>
      </div>
      {showChildren &&
        node.children.map((child) => (
          <FolderTreeItem
            key={child.uuid}
            node={child}
            teamUuid={teamUuid}
            depth={depth + 1}
            autoExpandedUuids={autoExpandedUuids}
          />
        ))}
    </div>
  );
}
