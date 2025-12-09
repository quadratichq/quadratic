import type { FilesListTemplateFile, FilesListUserFile } from '@/dashboard/components/FilesList';
import { FilesListItemCore } from '@/dashboard/components/FilesListItemCore';
import { Layout, Sort, type ViewPreferences } from '@/dashboard/components/FilesListViewControlsDropdown';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { useRootRouteLoaderData } from '@/routes/_root';
import type { Action as FileAction } from '@/routes/api.files.$uuid';
import {
  getActionFileDelete,
  getActionFileDownload,
  getActionFileDuplicate,
  getActionFileMove,
} from '@/routes/api.files.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { showUpgradeDialog } from '@/shared/atom/showUpgradeDialogAtom';
import { useConfirmDialog } from '@/shared/components/ConfirmProvider';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { FileIcon, MoreVertIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button as Btn } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Separator } from '@/shared/shadcn/ui/separator';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { timeAgo } from '@/shared/utils/timeAgo';
import { useEffect, useRef, useState } from 'react';
import type { SubmitOptions } from 'react-router';
import { Link, useFetcher, useMatch, useSubmit } from 'react-router';

export function FilesListItems({
  children,
  viewPreferences,
}: {
  children: React.ReactNode;
  viewPreferences: ViewPreferences;
}) {
  return (
    <ul
      className={cn(
        viewPreferences.layout === Layout.Grid && 'grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-4'
      )}
    >
      {children}
    </ul>
  );
}

export function FilesListItemUserFile({
  file,
  filterValue,
  setFilterValue,
  setActiveShareMenuFileId,
  lazyLoad,
  viewPreferences,
}: {
  file: FilesListUserFile;
  filterValue: string;
  setFilterValue: Function;
  setActiveShareMenuFileId: Function;
  lazyLoad: boolean;
  viewPreferences: ViewPreferences;
}) {
  const submit = useSubmit();
  const fetcherDelete = useFetcher();
  const fetcherDownload = useFetcher();
  const fetcherDuplicate = useFetcher();
  const fetcherRename = useFetcher();
  const fetcherMove = useFetcher({ key: 'move-file:' + file.uuid });
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [open, setOpen] = useState<boolean>(false);
  const fileDragRef = useRef<HTMLDivElement>(null);
  const { loggedInUser } = useRootRouteLoaderData();
  const {
    activeTeam: {
      team: { uuid: activeTeamUuid },
    },
    userMakingRequest: { id: userId },
  } = useDashboardRouteLoaderData();

  const { name, thumbnail, uuid, publicLinkAccess, permissions } = file;
  const actionUrl = ROUTES.API.FILE(uuid);
  const confirmFn = useConfirmDialog('deleteFile', { name });

  // Determine if the user can move files
  // If we're looking at the user's private files, make sure they have edit access to the team
  // If we're looking at a team, make sure they have edit access to the current team
  const isTeamPrivateFilesRoute = Boolean(useMatch(ROUTES.TEAM_FILES_PRIVATE(activeTeamUuid)));
  const isTeamPublicFilesRoute = Boolean(useMatch(ROUTES.TEAM_FILES(activeTeamUuid)));
  const canMoveFiles = (isTeamPrivateFilesRoute || isTeamPublicFilesRoute) && permissions.includes('FILE_MOVE');

  // Determine if this is a private/personal file (for duplicate and move logic)
  const isFilePrivate = file.isPrivate ?? isTeamPrivateFilesRoute;

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

  // Optimistically hide this file if it's being deleted or moved
  if (fetcherDelete.state !== 'idle' || fetcherMove.state !== 'idle') {
    return null;
  }

  const renameFile = (value: string) => {
    // Update on the server and optimistically in the UI
    const data: FileAction['request.rename'] = { action: 'rename', name: value };
    fetcherRename.submit(data, fetcherSubmitOpts);
  };

  const handleDelete = async () => {
    if (await confirmFn()) {
      const data = getActionFileDelete({ userEmail: loggedInUser?.email ?? '', redirect: false });
      fetcherDelete.submit(data, fetcherSubmitOpts);
    }
  };

  const handleDownload = () => {
    trackEvent('[Files].downloadFile', { id: uuid });
    const data = getActionFileDownload();
    fetcherDownload.submit(data, fetcherSubmitOpts);
  };

  const handleDuplicate = async () => {
    const { hasReachedLimit } = await apiClient.teams.fileLimit(activeTeamUuid, isFilePrivate);
    if (hasReachedLimit) {
      showUpgradeDialog('fileLimitReached');
      return;
    }
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

  const displayName = fetcherRename.json ? (fetcherRename.json as FileAction['request.rename']).name : name;
  const isDisabled = uuid.includes('duplicate');

  const dragProps = canMoveFiles
    ? {
        draggable: true,
        onDragStart: (event: React.DragEvent<HTMLAnchorElement>) => {
          if (fileDragRef.current) {
            fileDragRef.current.style.opacity = '1';
            event.dataTransfer.setDragImage(fileDragRef.current, 16, 16);
          }
          event.dataTransfer.dropEffect = 'move';
          event.dataTransfer.setData('application/quadratic-file-uuid', uuid);
        },
        onDragEnd: (event: React.DragEvent<HTMLAnchorElement>) => {
          if (fileDragRef.current) {
            fileDragRef.current.style.opacity = '0';
          }
        },
      }
    : {};

  return (
    <ListItem>
      <div
        ref={fileDragRef}
        // FYI: There's some trickery to get this displaying right across all browser
        // Basically this is hidden behind the file itself and when it's dragged
        // it becomes visible.
        className="absolute -top-[1px] left-0 z-0 flex items-center gap-1 rounded-full border border-background bg-primary px-2 py-0.5 text-sm text-primary-foreground opacity-0"
      >
        <FileIcon />
        {file.name.length > 16 ? file.name.slice(0, 16) + '…' : file.name}
      </div>
      <Link
        key={uuid}
        to={ROUTES.FILE({ uuid, searchParams: '' })}
        reloadDocument
        className={cn('relative z-10 w-full', isDisabled && `pointer-events-none opacity-50`)}
        {...dragProps}
      >
        <ListItemView viewPreferences={viewPreferences} thumbnail={thumbnail} lazyLoad={lazyLoad}>
          <FilesListItemCore
            key={uuid}
            creator={file.creator}
            filterValue={filterValue}
            setFilterValue={setFilterValue}
            filterMatch={file.filterMatch}
            name={displayName}
            description={description}
            hasNetworkError={Boolean(failedToDelete || failedToRename)}
            isShared={publicLinkAccess !== 'NOT_SHARED'}
            isPrivate={file.isPrivate}
            isSharedWithMe={file.isSharedWithMe}
            viewPreferences={viewPreferences}
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
                      Open file history
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
                          Move to Personal
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
                          Move to Team
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

export function FilesListItemExampleFile({
  file,
  filterValue,
  lazyLoad,
  viewPreferences,
}: {
  file: FilesListTemplateFile;
  filterValue: string;
  lazyLoad: boolean;
  viewPreferences: ViewPreferences;
}) {
  const { href, thumbnail, name, description } = file;
  return (
    <ListItem>
      <Link to={href} className="flex w-full" reloadDocument>
        <ListItemView viewPreferences={viewPreferences} thumbnail={thumbnail} lazyLoad={lazyLoad}>
          <FilesListItemCore
            name={name}
            description={description}
            filterValue={filterValue}
            viewPreferences={viewPreferences}
          />
        </ListItemView>
      </Link>
    </ListItem>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return <li className="relative flex">{children}</li>;
}

function ListItemView({
  viewPreferences,
  thumbnail,
  lazyLoad,
  children,
}: {
  viewPreferences: ViewPreferences;
  thumbnail: FilesListUserFile['thumbnail'];
  lazyLoad: boolean;
  children: React.ReactNode;
}) {
  const { layout } = viewPreferences;

  return layout === Layout.Grid ? (
    <div className="border border-border p-2 hover:bg-accent">
      <div className="flex aspect-video items-center justify-center bg-background">
        {thumbnail ? (
          <img
            loading={lazyLoad ? 'lazy' : 'eager'}
            src={thumbnail}
            crossOrigin="anonymous"
            alt="File thumbnail screenshot"
            className="dark-mode-hack object-cover"
            draggable="false"
          />
        ) : (
          <div className="flex items-center justify-center">
            <img
              src={'/favicon.ico'}
              alt="File thumbnail placeholder"
              className={`opacity-10 brightness-0 grayscale`}
              width="24"
              height="24"
              draggable="false"
            />
          </div>
        )}
      </div>
      <Separator className="border-accent" />
      <div className="pt-2">{children}</div>
    </div>
  ) : (
    <div className={`flex w-full flex-row items-center gap-4 py-2 hover:bg-accent lg:px-2`}>
      <div className={`hidden border border-border shadow-sm md:block`}>
        {thumbnail ? (
          <img
            loading={lazyLoad ? 'lazy' : 'eager'}
            src={thumbnail}
            crossOrigin="anonymous"
            alt="File thumbnail screenshot"
            className={`aspect-video object-fill`}
            width="80"
            draggable="false"
          />
        ) : (
          <div className="flex aspect-video w-20 items-center justify-center bg-background">
            <img
              src={'/favicon.ico'}
              alt="File thumbnail placeholder"
              className={`h-4 w-4 opacity-10 brightness-0 grayscale`}
              width="16"
              height="16"
              draggable="false"
            />
          </div>
        )}
      </div>
      <div className="flex-grow">{children}</div>
    </div>
  );
}
