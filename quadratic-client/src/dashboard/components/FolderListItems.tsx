import { getDragProps, useDropTarget } from '@/dashboard/hooks/useFolderDragDrop';
import { apiClient } from '@/shared/api/apiClient';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { FolderIcon, MoreVertIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { useState } from 'react';
import { Link, useRevalidator } from 'react-router';

interface FolderListItemsFolder {
  uuid: string;
  name: string;
  createdDate?: string;
  updatedDate?: string;
}

export function FolderListItems({ folders, teamUuid }: { folders: FolderListItemsFolder[]; teamUuid: string }) {
  if (folders.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Folders</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-4">
        {folders.map((folder) => (
          <FolderListItem key={folder.uuid} folder={folder} teamUuid={teamUuid} />
        ))}
      </div>
    </div>
  );
}

function FolderListItem({ folder, teamUuid }: { folder: FolderListItemsFolder; teamUuid: string }) {
  const dragProps = getDragProps({ type: 'folder', uuid: folder.uuid });
  const { isOver, onDragOver, onDragLeave, onDrop } = useDropTarget(folder.uuid);
  const revalidator = useRevalidator();
  const [showRename, setShowRename] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [optimisticName, setOptimisticName] = useState<string | null>(null);

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

  const handleDelete = async () => {
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
            <FolderIcon className="text-muted-foreground" />
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
            <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
