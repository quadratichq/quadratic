import { getDragProps, useDropTarget } from '@/dashboard/hooks/useFolderDragDrop';
import { apiClient } from '@/shared/api/apiClient';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { FolderIcon, FolderSpecialIcon, MoreVertIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/shadcn/ui/alert-dialog';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';
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
}: {
  folders: FolderListItemsFolder[];
  teamUuid: string;
  /** Fallback ownership for folders that don't include ownerUserId (e.g. subfolders) */
  ownerUserId?: number | null;
}) {
  if (folders.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Folders</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-4">
        {folders.map((folder) => (
          <FolderListItem key={folder.uuid} folder={folder} teamUuid={teamUuid} ownerUserId={ownerUserId} />
        ))}
      </div>
    </div>
  );
}

function FolderListItem({
  folder,
  teamUuid,
  ownerUserId,
}: {
  folder: FolderListItemsFolder;
  teamUuid: string;
  ownerUserId?: number | null;
}) {
  const effectiveOwnerUserId = folder.ownerUserId ?? ownerUserId ?? null;
  const dragProps = getDragProps({ type: 'folder', uuid: folder.uuid, ownerUserId: effectiveOwnerUserId });
  const { isOver, onDragOver, onDragLeave, onDrop } = useDropTarget(folder.uuid, effectiveOwnerUserId);
  const revalidator = useRevalidator();
  const [showRename, setShowRename] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePreview, setDeletePreview] = useState<{
    files: { uuid: string; name: string }[];
    subfolderCount: number;
  } | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [optimisticName, setOptimisticName] = useState<string | null>(null);

  const displayName = optimisticName ?? folder.name;

  useEffect(() => {
    if (!showDeleteDialog || !folder.uuid) return;
    setDeletePreviewLoading(true);
    setDeletePreview(null);
    apiClient.folders
      .getDeletePreview(folder.uuid)
      .then((data) => {
        setDeletePreview(data);
      })
      .catch(() => {
        setDeletePreview({ files: [], subfolderCount: 0 });
      })
      .finally(() => {
        setDeletePreviewLoading(false);
      });
  }, [showDeleteDialog, folder.uuid]);

  const handleRename = async (newName: string) => {
    setOptimisticName(newName);
    try {
      await apiClient.folders.update(folder.uuid, { name: newName });
      revalidator.revalidate();
    } catch {
      setOptimisticName(null);
    }
  };

  const confirmDelete = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);
    try {
      await apiClient.folders.delete(folder.uuid);
      revalidator.revalidate();
    } catch {
      setIsDeleting(false);
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
      <div className={cardClass} {...dragProps} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <Link
          to={ROUTES.TEAM_DRIVE_FOLDER(teamUuid, folder.uuid)}
          draggable={false}
          className="flex min-w-0 flex-1 items-center gap-2 no-underline outline-none"
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <MoreVertIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <DropdownMenuItem onClick={() => setShowRename(true)}>Rename</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                {deletePreviewLoading ? (
                  <span>Loading…</span>
                ) : deletePreview && deletePreview.files.length === 0 && deletePreview.subfolderCount === 0 ? (
                  <p>This will permanently remove the folder.</p>
                ) : (
                  <>
                    <p>
                      This will remove the folder and any subfolders. The folder cannot be recovered. The following
                      files will be moved to the trash and can be restored from Recover deleted files.
                    </p>
                    {deletePreview && (deletePreview.files.length > 0 || deletePreview.subfolderCount > 0) && (
                      <div className="mt-1 flex flex-col gap-1">
                        {deletePreview.subfolderCount > 0 && (
                          <p className="text-muted-foreground">
                            {deletePreview.subfolderCount} subfolder{deletePreview.subfolderCount !== 1 ? 's' : ''}
                          </p>
                        )}
                        {deletePreview.files.length > 0 && (
                          <div className="max-h-40 overflow-y-auto rounded border border-border bg-muted/30 p-2">
                            <ul className="list-inside list-disc space-y-0.5 text-sm">
                              {deletePreview.files.map((f) => (
                                <li key={f.uuid} className="truncate">
                                  {f.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePreviewLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deletePreviewLoading}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
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
