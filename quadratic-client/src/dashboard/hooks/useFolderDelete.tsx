import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/shadcn/ui/alert-dialog';
import { ROUTES } from '@/shared/constants/routes';
import { useEffect, useState } from 'react';
import { useNavigate, useRevalidator } from 'react-router';

export type FolderDeletePreview = {
  files: { uuid: string; name: string }[];
  subfolderCount: number;
};

export type UseFolderDeleteOptions = {
  teamUuid: string;
  /** Parent folder UUID when the deleted folder is a subfolder; null when it's a top-level folder. */
  parentFolderUuid: string | null;
  isPrivate: boolean;
};

export function useFolderDelete(folderUuid: string, options: UseFolderDeleteOptions) {
  const { teamUuid, parentFolderUuid, isPrivate } = options;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePreview, setDeletePreview] = useState<FolderDeletePreview | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [deletePreviewError, setDeletePreviewError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!showDeleteDialog || !folderUuid) return;
    setDeletePreviewLoading(true);
    setDeletePreview(null);
    setDeletePreviewError(false);
    apiClient.folders
      .getDeletePreview(folderUuid)
      .then((data) => setDeletePreview(data))
      .catch(() => setDeletePreviewError(true))
      .finally(() => setDeletePreviewLoading(false));
  }, [showDeleteDialog, folderUuid]);

  const confirmDelete = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);
    try {
      await apiClient.folders.delete(folderUuid);
      const targetPath = parentFolderUuid
        ? ROUTES.TEAM_DRIVE_FOLDER(teamUuid, parentFolderUuid)
        : isPrivate
          ? ROUTES.TEAM_DRIVE_PRIVATE(teamUuid)
          : ROUTES.TEAM_DRIVE_TEAM(teamUuid);
      navigate(targetPath);
      revalidator.revalidate();
    } catch {
      setIsDeleting(false);
      addGlobalSnackbar('Failed to delete folder. Try again.', { severity: 'error' });
    }
  };

  return {
    showDeleteDialog,
    setShowDeleteDialog,
    deletePreview,
    deletePreviewLoading,
    deletePreviewError,
    isDeleting,
    confirmDelete,
  };
}

type FolderDeleteAlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deletePreview: FolderDeletePreview | null;
  deletePreviewLoading: boolean;
  deletePreviewError: boolean;
  onConfirm: () => void;
};

/**
 * Shared delete-folder confirmation dialog content.
 * Use with useFolderDelete so both FolderListItems and DashboardSidebarFolderTree share the same UI.
 */
export function FolderDeleteAlertDialog({
  open,
  onOpenChange,
  deletePreview,
  deletePreviewLoading,
  deletePreviewError,
  onConfirm,
}: FolderDeleteAlertDialogProps) {
  return (
    <AlertDialogContent className="max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete folder?</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="flex flex-col gap-2">
            {deletePreviewLoading ? (
              <span>Loading…</span>
            ) : deletePreviewError ? (
              <p>
                We couldn't load the list of files. The folder and all its contents (including any subfolders and files)
                will be removed. Files will be moved to the trash and can be restored from Recover deleted files.
              </p>
            ) : deletePreview && deletePreview.files.length === 0 && deletePreview.subfolderCount === 0 ? (
              <p>This will permanently remove the folder.</p>
            ) : (
              <>
                <p>
                  This will remove the folder and any subfolders.
                  <br />
                  <br />
                  {deletePreview && deletePreview.files.length > 0 && (
                    <>
                      {' '}
                      {deletePreview.files.length} file{deletePreview.files.length !== 1 ? 's' : ''} will be moved to
                      the trash and can be restored from Recover deleted files.
                    </>
                  )}
                </p>
                {deletePreview && deletePreview.files.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded border border-border bg-muted/30 p-2">
                    <div className="flex flex-col gap-1 text-sm">
                      {deletePreview.files.map((f) => (
                        <div key={f.uuid} className="truncate">
                          {f.name}
                        </div>
                      ))}
                    </div>
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
            onConfirm();
          }}
          disabled={deletePreviewLoading}
          variant="destructive"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
