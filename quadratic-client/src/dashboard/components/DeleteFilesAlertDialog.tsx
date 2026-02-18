import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/shadcn/ui/alert-dialog';

export type DeleteFilesAlertDialogProps = {
  /** Number of files (1 or more). */
  fileCount: number;
  /** Optional list of file names to show in a scrollable list. */
  fileNames?: string[];
  onConfirm: () => void;
};

/**
 * Reusable confirmation content for deleting one or more files.
 * Wrap in <AlertDialog open={...} onOpenChange={...}> and render this as the dialog content.
 * Files are described as moved to trash and restorable from Recover deleted files.
 */
export function DeleteFilesAlertDialog({ fileCount, fileNames, onConfirm }: DeleteFilesAlertDialogProps) {
  const title = fileCount === 1 ? 'Delete file?' : `Delete ${fileCount} files?`;
  const description =
    fileCount === 1
      ? 'This file will be moved to the trash and can be restored from Recover deleted files.'
      : `${fileCount} files will be moved to the trash and can be restored from Recover deleted files.`;

  return (
    <AlertDialogContent className="max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="flex flex-col gap-2">
            <p>{description}</p>
            {fileNames != null && fileNames.length > 0 && (
              <div className="max-h-52 overflow-y-auto rounded border border-border bg-muted/30 p-2">
                <div className="flex flex-col gap-1 text-sm">
                  {fileNames.map((name, i) => (
                    <div key={i} className="truncate">
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            e.preventDefault();
            onConfirm();
          }}
          variant="destructive"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
