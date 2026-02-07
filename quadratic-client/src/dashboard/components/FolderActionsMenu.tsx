import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';

export function FolderActionsMenuContent({
  onRename,
  onDelete,
  align = 'end',
  className = 'w-40',
}: {
  onRename: () => void;
  onDelete: () => void;
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
      <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onDelete}>Delete</DropdownMenuItem>
    </DropdownMenuContent>
  );
}
