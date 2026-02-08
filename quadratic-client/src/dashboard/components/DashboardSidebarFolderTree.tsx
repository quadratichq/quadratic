import { CreateFolderDialog } from '@/dashboard/components/CreateFolderDialog';
import { FolderActionsMenuContent } from '@/dashboard/components/FolderActionsMenu';
import { useCreateFile } from '@/dashboard/hooks/useCreateFile';
import { FolderDeleteAlertDialog, useFolderDelete } from '@/dashboard/hooks/useFolderDelete';
import { getDragProps, useDropTarget } from '@/dashboard/hooks/useFolderDragDrop';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { AddIcon, ChevronRightIcon, FolderIcon, FolderSpecialIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { AlertDialog } from '@/shared/shadcn/ui/alert-dialog';
import { Button } from '@/shared/shadcn/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useNavigation, useParams, useRevalidator } from 'react-router';

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

export function DashboardSidebarFolderTree({
  teamUuid,
  filter,
  userId,
  forceShow,
  canEditTeam,
}: {
  teamUuid: string;
  filter: 'team' | 'private';
  userId: number;
  /** When true, the tree is shown even if the current view isn't relevant (e.g. during drag-hover reveal). */
  forceShow?: boolean;
  canEditTeam?: boolean;
}) {
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

  if ((!isRelevantView && !forceShow) || tree.length === 0) return null;

  // The target ownership for drop targets: null for team folders, userId for private folders
  const targetOwnerUserId = filter === 'team' ? null : userId;

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {tree.map((node) => (
        <FolderTreeItem
          key={node.uuid}
          node={node}
          teamUuid={teamUuid}
          depth={0}
          autoExpandedUuids={autoExpandedUuids}
          targetOwnerUserId={targetOwnerUserId}
          canEditTeam={canEditTeam}
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
  targetOwnerUserId,
  canEditTeam,
}: {
  node: FolderTreeNode;
  teamUuid: string;
  depth: number;
  autoExpandedUuids: Set<string>;
  targetOwnerUserId: number | null;
  canEditTeam?: boolean;
}) {
  const [isManuallyExpanded, setIsManuallyExpanded] = useState<boolean | null>(null);
  const { isOver: isDropTarget, onDragOver, onDragLeave, onDrop } = useDropTarget(node.uuid, targetOwnerUserId);
  const dragProps = getDragProps({ type: 'folder', uuid: node.uuid, ownerUserId: node.ownerUserId });
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const to = ROUTES.TEAM_DRIVE_FOLDER(teamUuid, node.uuid);
  const hasChildren = node.children.length > 0;

  // Context menu (right-click): reuse same options as three-dot menu; only open from right-click, not left
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const contextMenuRequestedRef = useRef(false);
  const [showRename, setShowRename] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [optimisticName, setOptimisticName] = useState<string | null>(null);
  const {
    showDeleteDialog,
    setShowDeleteDialog,
    deletePreview,
    deletePreviewLoading,
    deletePreviewError,
    isDeleting,
    confirmDelete,
  } = useFolderDelete(node.uuid, {
    teamUuid,
    parentFolderUuid: node.parentFolderUuid,
    isPrivate: node.ownerUserId !== null,
  });
  const displayName = optimisticName ?? node.name;

  const handleRename = async (newName: string) => {
    setOptimisticName(newName);
    try {
      await apiClient.folders.update(node.uuid, { name: newName });
      revalidator.revalidate();
    } catch {
      setOptimisticName(null);
      addGlobalSnackbar('Failed to rename folder. Try again.', { severity: 'error' });
    }
  };

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

  // Auto-expand collapsed folders after hovering with a drag for 500ms
  const dragExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isDropTarget && hasChildren && !isExpanded) {
      dragExpandTimer.current = setTimeout(() => {
        setIsManuallyExpanded(true);
      }, 500);
    }
    return () => {
      if (dragExpandTimer.current) {
        clearTimeout(dragExpandTimer.current);
        dragExpandTimer.current = null;
      }
    };
  }, [isDropTarget, hasChildren, isExpanded]);

  // Indentation is icon-based. Chevron sits in the gap between parent icon and this row's icon (not to the left of parent).
  // Root (depth 0) uses same alignment as subfolders: chevron starts where the nav link icon is (p-2 = 8px).
  const CHEVRON_PX = 24;
  const ROOT_OFFSET_PX = 8;
  const iconLeftPx = ROOT_OFFSET_PX + (depth + 1) * CHEVRON_PX;
  const chevronLeftPx = ROOT_OFFSET_PX + depth * CHEVRON_PX;

  const { createFile } = useCreateFile();

  const handleCreateFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    createFile({ isPrivate: node.ownerUserId !== null, folderUuid: node.uuid });
  };

  const handleNewFileFromMenu = () => {
    createFile({ isPrivate: node.ownerUserId !== null, folderUuid: node.uuid });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canEditTeam) return;
    e.preventDefault();
    navigate(to);
    contextMenuRequestedRef.current = true;
    setContextMenuOpen(true);
  };

  const handleContextMenuOpenChange = (open: boolean) => {
    if (open && !contextMenuRequestedRef.current) return;
    contextMenuRequestedRef.current = false;
    setContextMenuOpen(open);
  };

  // Optimistically hide while deleting
  if (isDeleting) return null;

  const row = (
    <div
      className={cn(
        'group relative flex min-w-0 items-center gap-0.5 overflow-hidden rounded py-1 text-sm no-underline transition-colors',
        'bg-accent hover:brightness-95 hover:saturate-150 dark:hover:brightness-125 dark:hover:saturate-100',
        isActive && 'brightness-95 saturate-150 dark:brightness-125 dark:saturate-100',
        isDropTarget && 'border border-primary bg-primary/10',
        'pl-3 pr-11',
        canEditTeam && 'cursor-context-menu'
      )}
      style={{ paddingLeft: `${iconLeftPx + 12}px` }}
      {...dragProps}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      {...(canEditTeam && { onContextMenu: handleContextMenu })}
    >
      <DropdownMenu open={contextMenuOpen} onOpenChange={handleContextMenuOpenChange}>
        {/* Hidden trigger used only as positioning anchor for the dropdown.
            pointer-events-none prevents it from intercepting drag/pointer events. */}
        <DropdownMenuTrigger
          className="pointer-events-none absolute inset-0 m-0 border-none bg-transparent p-0 opacity-0 outline-none"
          tabIndex={-1}
        />
        <FolderActionsMenuContent
          onRename={() => setShowRename(true)}
          onDelete={() => setShowDeleteDialog(true)}
          onNewFile={handleNewFileFromMenu}
          onNewFolder={() => setShowCreateFolder(true)}
        />
      </DropdownMenu>
      <button
        className={cn(
          'absolute flex h-full w-6 items-center justify-center rounded p-0 hover:bg-accent',
          !hasChildren && 'invisible'
        )}
        style={{ left: `${chevronLeftPx + 12}px` }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsManuallyExpanded(!isExpanded);
        }}
      >
        <ChevronRightIcon className={cn('text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
      </button>
      <NavLink to={to} className="flex min-w-0 flex-grow items-center gap-1.5 no-underline">
        {node.ownerUserId !== null ? (
          <FolderSpecialIcon className="shrink-0 text-muted-foreground" />
        ) : (
          <FolderIcon className="shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 truncate" title={displayName}>
          {displayName}
        </span>
      </NavLink>
      {canEditTeam && (
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="!bg-transparent text-muted-foreground hover:opacity-100"
                onClick={handleCreateFile}
              >
                <AddIcon />
              </Button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent>New file</TooltipContent>
            </TooltipPortal>
          </Tooltip>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {row}
      {showChildren &&
        node.children.map((child) => (
          <FolderTreeItem
            key={child.uuid}
            node={child}
            teamUuid={teamUuid}
            depth={depth + 1}
            autoExpandedUuids={autoExpandedUuids}
            targetOwnerUserId={targetOwnerUserId}
            canEditTeam={canEditTeam}
          />
        ))}
      {canEditTeam && (
        <>
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <FolderDeleteAlertDialog
              open={showDeleteDialog}
              onOpenChange={setShowDeleteDialog}
              deletePreview={deletePreview}
              deletePreviewLoading={deletePreviewLoading}
              deletePreviewError={deletePreviewError}
              onConfirm={confirmDelete}
            />
          </AlertDialog>
          {showCreateFolder && (
            <CreateFolderDialog
              teamUuid={teamUuid}
              parentFolderUuid={node.uuid}
              isPrivate={node.ownerUserId !== null}
              onClose={() => setShowCreateFolder(false)}
            />
          )}
          {showRename && (
            <DialogRenameItem
              itemLabel="Folder"
              onClose={() => setShowRename(false)}
              value={displayName}
              onSave={handleRename}
            />
          )}
        </>
      )}
    </div>
  );
}
