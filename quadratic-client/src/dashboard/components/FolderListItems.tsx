import { FolderActionsMenuContent } from '@/dashboard/components/FolderActionsMenu';
import { useFolderDelete, FolderDeleteAlertDialog } from '@/dashboard/hooks/useFolderDelete';
import { getDragProps, useDropTarget } from '@/dashboard/hooks/useFolderDragDrop';
import { apiClient } from '@/shared/api/apiClient';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { FolderIcon, FolderSpecialIcon, MoreVertIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { AlertDialog } from '@/shared/shadcn/ui/alert-dialog';
import { Button } from '@/shared/shadcn/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { useState } from 'react';
import { Link, useRevalidator } from 'react-router';

interface FolderListItemsFolder {
  uuid: string;
  name: string;
  ownerUserId?: number | null;
}

export function FolderListItems({
  folders,
  teamUuid,
  ownerUserId,
  canEdit,
  /** UUID of the folder we're viewing (parent of these subfolders). Used for redirect after delete. */
  parentFolderUuid = null,
  isPrivate = false,
}: {
  folders: FolderListItemsFolder[];
  teamUuid: string;
  /** Fallback ownership for folders that don't include ownerUserId (e.g. subfolders) */
  ownerUserId?: number | null;
  /** Whether the user can edit folder structure (create/rename/delete/move). False for team viewers. */
  canEdit?: boolean;
  /** Parent folder UUID when viewing a folder (so after delete we stay on this folder). */
  parentFolderUuid?: string | null;
  /** Whether this is the private drive (for redirect when deleting a top-level folder). */
  isPrivate?: boolean;
}) {
  if (folders.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Folders</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-4">
        {folders.map((folder) => (
          <FolderListItem
            key={folder.uuid}
            folder={folder}
            teamUuid={teamUuid}
            ownerUserId={ownerUserId}
            canEdit={canEdit ?? false}
            parentFolderUuid={parentFolderUuid}
            isPrivate={isPrivate}
          />
        ))}
      </div>
    </div>
  );
}

function FolderListItem({
  folder,
  teamUuid,
  ownerUserId,
  canEdit,
  parentFolderUuid,
  isPrivate,
}: {
  folder: FolderListItemsFolder;
  teamUuid: string;
  ownerUserId?: number | null;
  canEdit: boolean;
  parentFolderUuid: string | null;
  isPrivate: boolean;
}) {
  const effectiveOwnerUserId = folder.ownerUserId ?? ownerUserId ?? null;
  const dragProps = getDragProps({ type: 'folder', uuid: folder.uuid, ownerUserId: effectiveOwnerUserId });
  const { isOver, onDragOver, onDragLeave, onDrop } = useDropTarget(folder.uuid, effectiveOwnerUserId);
  const revalidator = useRevalidator();
  const [showRename, setShowRename] = useState(false);
  const [optimisticName, setOptimisticName] = useState<string | null>(null);
  const {
    showDeleteDialog,
    setShowDeleteDialog,
    deletePreview,
    deletePreviewLoading,
    deletePreviewError,
    isDeleting,
    confirmDelete,
  } = useFolderDelete(folder.uuid, {
    teamUuid,
    parentFolderUuid,
    isPrivate,
  });

  const displayName = optimisticName ?? folder.name;

  const handleRename = async (newName: string) => {
    setOptimisticName(newName);
    try {
      await apiClient.folders.update(folder.uuid, { name: newName });
      revalidator.revalidate();
    } catch {
      setOptimisticName(null);
    }
  };

  // Optimistically hide while deleting
  if (isDeleting) return null;

  const cardClass = cn(
    'group relative flex items-center gap-2 rounded-md border border-border p-2 no-underline transition-colors',
    'hover:bg-accent',
    isOver && 'border-primary bg-primary/10'
  );

  return (
    <>
      <div className={cardClass} {...(canEdit && { ...dragProps, onDragOver, onDragLeave, onDrop })}>
        <Link
          to={ROUTES.TEAM_DRIVE_FOLDER(teamUuid, folder.uuid)}
          draggable={false}
          className="flex min-w-0 flex-1 items-center gap-2 no-underline outline-none"
          {...(canEdit && { onDragOver, onDragLeave, onDrop })}
        >
          <div className="flex shrink-0 items-center justify-center">
            {effectiveOwnerUserId !== null ? (
              <FolderSpecialIcon className="text-muted-foreground" />
            ) : (
              <FolderIcon className="text-muted-foreground" />
            )}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName}</span>
        </Link>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-foreground data-[state=open]:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreVertIcon />
              </Button>
            </DropdownMenuTrigger>
            <FolderActionsMenuContent onRename={() => setShowRename(true)} onDelete={() => setShowDeleteDialog(true)} />
          </DropdownMenu>
        )}
      </div>
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
      {showRename && (
        <DialogRenameItem
          itemLabel="Folder"
          onClose={() => setShowRename(false)}
          value={displayName}
          onSave={handleRename}
        />
      )}
    </>
  );
}
