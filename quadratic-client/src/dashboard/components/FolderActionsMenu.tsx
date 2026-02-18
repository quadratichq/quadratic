import { FileIcon, FolderIcon } from '@/shared/components/Icons';
import { DropdownMenuContent, DropdownMenuItem } from '@/shared/shadcn/ui/dropdown-menu';

export function FolderActionsMenuContent({
  onRename,
  onDelete,
  onNewFile,
  onNewFolder,
  align = 'end',
  className = 'w-40',
}: {
  onRename: () => void;
  onDelete: () => void;
  /** When provided, shows "New file" to create a file in this folder. */
  onNewFile?: () => void;
  /** When provided, shows "New folder" to create a subfolder. */
  onNewFolder?: () => void;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <DropdownMenuContent
      align={align}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {onNewFile != null && (
        <DropdownMenuItem onClick={onNewFile}>
          <FileIcon size="sm" className="mr-2" />
          New file
        </DropdownMenuItem>
      )}
      {onNewFolder != null && (
        <DropdownMenuItem onClick={onNewFolder}>
          <FolderIcon size="sm" className="mr-2" />
          New folder
        </DropdownMenuItem>
      )}
      {(onNewFile != null || onNewFolder != null) && <div className="my-1 h-px bg-border" role="separator" />}
      <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
      <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
    </DropdownMenuContent>
  );
}
