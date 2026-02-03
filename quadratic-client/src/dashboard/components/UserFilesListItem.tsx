import { userFilesListFiltersAtom } from '@/dashboard/atoms/userFilesListFiltersAtom';
import { FilesListItemCore } from '@/dashboard/components/FilesListItemCore';
import { ListItem, ListItemView } from '@/dashboard/components/FilesListItems';
import { Layout, Sort, type ViewPreferences } from '@/dashboard/components/FilesListViewControlsDropdown';
import type { UserFilesListFile } from '@/dashboard/components/UserFilesList';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { useRootRouteLoaderData } from '@/routes/_root';
import type { Action as FileAction } from '@/routes/api.files.$uuid';
import {
  getActionFileDelete,
  getActionFileDownload,
  getActionFileDuplicate,
  getActionFileMove,
} from '@/routes/api.files.$uuid';
import { showUpgradeDialog } from '@/shared/atom/showUpgradeDialogAtom';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { MoreVertIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button as Btn } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { timeAgo } from '@/shared/utils/timeAgo';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import type { SubmitOptions } from 'react-router';
import { Link, useFetcher, useSubmit } from 'react-router';

export function UserFilesListItem({
  file,
  setActiveShareMenuFileId,
  lazyLoad,
  viewPreferences,
}: {
  file: UserFilesListFile;
  setActiveShareMenuFileId: React.Dispatch<React.SetStateAction<string>>;
  lazyLoad: boolean;
  viewPreferences: ViewPreferences;
}) {
  const filters = useAtomValue(userFilesListFiltersAtom);
  const setFilters = useSetAtom(userFilesListFiltersAtom);
  const submit = useSubmit();
  const fetcherDelete = useFetcher();
  const fetcherDownload = useFetcher();
  const fetcherDuplicate = useFetcher();
  const fetcherRename = useFetcher();
  const fetcherMove = useFetcher({ key: 'move-file:' + file.uuid });
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [open, setOpen] = useState<boolean>(false);
  const { loggedInUser } = useRootRouteLoaderData();
  const {
    activeTeam: {
      team: { uuid: activeTeamUuid },
    },
    userMakingRequest: { id: userId },
  } = useDashboardRouteLoaderData();

  const { name, thumbnail, uuid, permissions } = file;
  let { fileType } = file;

  const actionUrl = ROUTES.API.FILE(uuid);

  // Determine if the user can move files
  const canMoveFiles = permissions.includes('FILE_MOVE');

  const description =
    viewPreferences.sort === Sort.Created
      ? `Created ${timeAgo(file.createdDate)}`
      : `Modified ${timeAgo(file.updatedDate)}`;
  const fetcherSubmitOpts: SubmitOptions = {
    method: 'POST',
    action: actionUrl,
    encType: 'application/json',
  };
  const failedToDelete = fetcherDelete.data && !fetcherDelete.data.ok;
  const failedToRename = fetcherRename.data && !fetcherRename.data.ok;

  // If the download fails, show an error
  // TODO async communication in UI that the file is downloading?
  useEffect(() => {
    if (fetcherDownload.data && !fetcherDownload.data.ok) {
      addGlobalSnackbar('Failed to download file. Try again.', { severity: 'error' });
    }
  }, [addGlobalSnackbar, fetcherDownload.data]);

  // If the move fails, show an error
  useEffect(() => {
    if (fetcherMove.data && !fetcherMove.data.ok) {
      addGlobalSnackbar('Failed to move file. Try again.', { severity: 'error' });
    }
  }, [addGlobalSnackbar, fetcherMove.data]);

  // TODO:(jimniels) enhancement
  // optimistic updates should probably be moved up to UserFilesList
  // so all updates flow down from there.

  // Optimistically hide this file if it's being deleted
  if (fetcherDelete.state !== 'idle') {
    return null;
  }

  // Optimistically hide the file if it's being moved _and_ you're on private or team listings
  if (fetcherMove.state !== 'idle' && (filters.fileType === 'private' || filters.fileType === 'team')) {
    return null;
  }

  // Optimistically update file type if it's being moved
  if (fetcherMove.state !== 'idle') {
    const ownerUserId = (fetcherMove.json as FileAction['request.move']).ownerUserId;
    fileType = ownerUserId ? 'private' : 'team';
  }

  // Determine if this is a private/personal file (for duplicate and move logic)
  const isFilePrivate = fileType === 'private';

  const displayName = fetcherRename.json ? (fetcherRename.json as FileAction['request.rename']).name : name;
  const isDisabled = uuid.includes('duplicate');

  const renameFile = (value: string) => {
    // Update on the server and optimistically in the UI
    const data: FileAction['request.rename'] = { action: 'rename', name: value };
    fetcherRename.submit(data, fetcherSubmitOpts);
  };

  const handleDelete = async () => {
    const data = getActionFileDelete({ userEmail: loggedInUser?.email ?? '', redirect: false });
    fetcherDelete.submit(data, fetcherSubmitOpts);
  };

  const handleDownload = () => {
    trackEvent('[Files].downloadFile', { id: uuid });
    const data = getActionFileDownload();
    fetcherDownload.submit(data, fetcherSubmitOpts);
  };

  const handleDuplicate = () => {
    trackEvent('[Files].duplicateFile', { id: uuid });
    const data = getActionFileDuplicate({
      redirect: false,
      isPrivate: isFilePrivate,
      teamUuid: activeTeamUuid,
    });
    fetcherDuplicate.submit(data, fetcherSubmitOpts);
  };

  const handleShare = () => {
    setActiveShareMenuFileId(uuid);
    trackEvent('[FileSharing].menu.open', { context: 'dashboard', pathname: window.location.pathname });
  };

  return (
    <ListItem>
      <Link
        key={uuid}
        to={ROUTES.FILE({ uuid, searchParams: '' })}
        reloadDocument
        className={cn('relative z-10 w-full', isDisabled && `pointer-events-none opacity-50`)}
      >
        <ListItemView
          viewPreferences={viewPreferences}
          thumbnail={thumbnail}
          lazyLoad={lazyLoad}
          overlay={file.requiresUpgradeToEdit ? <FileEditRestrictedBadge /> : undefined}
        >
          <FilesListItemCore
            key={uuid}
            creator={file.creator}
            name={displayName}
            nameFilter={filters.fileName}
            description={description}
            hasNetworkError={Boolean(failedToDelete || failedToRename)}
            viewPreferences={viewPreferences}
            children={<FileTypeBadge type={fileType} />}
            onCreatorClick={(creator) => {
              if (creator.email) {
                setFilters((prev) => ({
                  ...prev,
                  fileCreatorEmails:
                    prev.fileCreatorEmails.length === 1 && prev.fileCreatorEmails[0] === creator.email
                      ? []
                      : [creator.email!],
                }));
              }
            }}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Btn
                    variant="ghost"
                    size="icon"
                    className={cn(
                      viewPreferences.layout === Layout.Grid ? 'absolute right-2 top-2' : 'flex-shrink-0',
                      'hover:border hover:bg-background hover:text-foreground hover:shadow-sm data-[state=open]:border data-[state=open]:bg-background data-[state=open]:text-foreground data-[state=open]:shadow-sm',
                      'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <MoreVertIcon className="text h-4 w-4" />
                  </Btn>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {permissions.includes('FILE_VIEW') && (
                    <DropdownMenuItem onClick={handleShare} data-testid="dashboard-file-actions-share">
                      Share
                    </DropdownMenuItem>
                  )}
                  {permissions.includes('FILE_EDIT') && (
                    <DropdownMenuItem onClick={handleDuplicate} data-testid="dashboard-file-actions-duplicate">
                      Duplicate
                    </DropdownMenuItem>
                  )}
                  {permissions.includes('FILE_EDIT') && (
                    <DropdownMenuItem onClick={() => setOpen(true)} data-testid="dashboard-file-actions-rename">
                      Rename
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleDownload} data-testid="dashboard-file-actions-download">
                    Download
                  </DropdownMenuItem>
                  {permissions.includes('FILE_EDIT') && (
                    <DropdownMenuItem
                      data-testid="dashboard-file-actions-open-history"
                      onClick={() => {
                        window.open(ROUTES.FILE_HISTORY(uuid), '_blank');
                      }}
                    >
                      Open history
                    </DropdownMenuItem>
                  )}
                  {canMoveFiles && (
                    <>
                      <DropdownMenuSeparator />
                      {!isFilePrivate && (
                        <DropdownMenuItem
                          data-testid="dashboard-file-actions-move-to-personal"
                          onClick={() => {
                            const data = getActionFileMove(userId);
                            submit(data, {
                              method: 'POST',
                              action: actionUrl,
                              encType: 'application/json',
                              navigate: false,
                              fetcherKey: `move-file:${uuid}`,
                            });
                          }}
                        >
                          Move to personal files
                        </DropdownMenuItem>
                      )}
                      {isFilePrivate && (
                        <DropdownMenuItem
                          data-testid="dashboard-file-actions-move-to-team"
                          onClick={() => {
                            const data = getActionFileMove(null);
                            submit(data, {
                              method: 'POST',
                              action: actionUrl,
                              encType: 'application/json',
                              navigate: false,
                              fetcherKey: `move-file:${uuid}`,
                            });
                          }}
                        >
                          Move to team files
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {permissions.includes('FILE_DELETE') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDelete} data-testid="dashboard-file-actions-delete">
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        </ListItemView>
      </Link>
      {open && (
        <DialogRenameItem
          itemLabel={'File'}
          onClose={() => setOpen(false)}
          value={displayName}
          onSave={(newValue: string) => {
            renameFile(newValue);
          }}
        />
      )}
    </ListItem>
  );
}

function FileTypeBadge({ type }: { type: 'shared' | 'private' | 'team' }) {
  const label = type === 'shared' ? 'Shared with me' : type === 'private' ? 'Personal' : 'Team';

  return (
    <div className={'flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs text-muted-foreground'}>
      {label}
    </div>
  );
}

/**
 * Badge/button shown on files that are not editable due to billing limits (soft file limit).
 * This is distinct from "View only" which is permission-based.
 * Clicking opens the upgrade dialog.
 */
function FileEditRestrictedBadge() {
  return (
    <button
      className={
        'flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground'
      }
      title="This file exceeds your plan's limit. Upgrade for unlimited editable files."
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        showUpgradeDialog('fileLimitReached');
      }}
    >
      Upgrade to edit
    </button>
  );
}
