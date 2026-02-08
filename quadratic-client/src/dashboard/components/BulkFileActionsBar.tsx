import { DeleteFilesAlertDialog } from '@/dashboard/components/DeleteFilesAlertDialog';
import { MoveToFolderBulkDialog } from '@/dashboard/components/MoveToFolderDialog';
import { useRootRouteLoaderData } from '@/routes/_root';
import { getActionFileDelete } from '@/routes/api.files.$uuid';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CloseIcon, DeleteIcon, DriveFileMoveIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { AlertDialog } from '@/shared/shadcn/ui/alert-dialog';
import { Button } from '@/shared/shadcn/ui/button';
import { useState } from 'react';

export function BulkFileActionsBar({
  selectedFiles,
  onClearSelection,
}: {
  selectedFiles: Array<{ uuid: string; name: string }>;
  onClearSelection: () => void;
}) {
  const { loggedInUser } = useRootRouteLoaderData();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const count = selectedFiles.length;
  const uuids = selectedFiles.map((f) => f.uuid);
  const fileNames = selectedFiles.map((f) => f.name);

  const performDelete = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);
    const userEmail = loggedInUser?.email ?? '';
    const body = getActionFileDelete({ userEmail, redirect: false });

    const results = await Promise.all(
      uuids.map(async (uuid) => {
        const res = await fetch(ROUTES.API.FILE(uuid), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'same-origin',
        });
        const data = await res.json().catch(() => ({ ok: false }));
        return data?.ok === true;
      })
    );

    setIsDeleting(false);
    const succeeded = results.filter(Boolean).length;
    const failed = results.length - succeeded;

    if (failed > 0) {
      addGlobalSnackbar(
        failed === results.length
          ? `Failed to delete ${count} file${count === 1 ? '' : 's'}.`
          : `${succeeded} deleted; ${failed} failed.`,
        { severity: 'error' }
      );
    } else {
      onClearSelection();
      addGlobalSnackbar(`${count} file${count === 1 ? '' : 's'} deleted.`);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">
          {count} file{count === 1 ? '' : 's'} selected
        </span>
        <Button variant="ghost" size="sm" onClick={onClearSelection} className="gap-1.5">
          <CloseIcon />
          Clear
        </Button>
        <div className="h-4 w-px bg-border" aria-hidden />
        <Button variant="outline" size="sm" onClick={() => setShowMoveDialog(true)} className="gap-1.5">
          <DriveFileMoveIcon />
          Move to folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isDeleting}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <DeleteIcon />
          {isDeleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>

      {showMoveDialog && (
        <MoveToFolderBulkDialog
          fileUuids={uuids}
          onClose={() => {
            setShowMoveDialog(false);
            onClearSelection();
          }}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DeleteFilesAlertDialog fileCount={count} fileNames={fileNames} onConfirm={performDelete} />
      </AlertDialog>
    </>
  );
}
