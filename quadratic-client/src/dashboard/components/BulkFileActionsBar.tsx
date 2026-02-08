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
import { useSubmit } from 'react-router';

export function BulkFileActionsBar({
  selectedFiles,
  onClearSelection,
}: {
  selectedFiles: Array<{ uuid: string; name: string }>;
  onClearSelection: () => void;
}) {
  const { loggedInUser } = useRootRouteLoaderData();
  const submit = useSubmit();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const count = selectedFiles.length;
  const uuids = selectedFiles.map((f) => f.uuid);
  const fileNames = selectedFiles.map((f) => f.name);

  const performDelete = () => {
    setShowDeleteDialog(false);
    const userEmail = loggedInUser?.email ?? '';
    for (const uuid of uuids) {
      submit(getActionFileDelete({ userEmail, redirect: false }), {
        method: 'POST',
        action: ROUTES.API.FILE(uuid),
        encType: 'application/json',
        navigate: false,
      });
    }
    onClearSelection();
    addGlobalSnackbar(`${count} file${count === 1 ? '' : 's'} deleted.`);
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
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <DeleteIcon />
          Delete
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
