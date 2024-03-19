import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Action as FileAction } from '@/routes/files.$uuid';
import { useTeamRouteLoaderData } from '@/routes/teams.$uuid';
import { Button as Btn } from '@/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shadcn/ui/dropdown-menu';
import { Separator } from '@/shadcn/ui/separator';
import { cn } from '@/shadcn/utils';
import { DotsVerticalIcon, FileIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { useEffect, useRef, useState } from 'react';
import { Link, SubmitOptions, useFetcher, useLocation, useSubmit } from 'react-router-dom';
import { deleteFile, downloadFileAction, duplicateFileWithCurrentOwnerAction, renameFileAction } from '../../actions';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../constants/routes';
import { DialogRenameItem } from './DialogRenameItem';
import { FilesListFile } from './FilesList';
import { FilesListItemCore } from './FilesListItemCore';
import { Layout, ViewPreferences } from './FilesListViewControlsDropdown';

type FileDisplay = {
  href: FilesListFile['href'];
  thumbnail: FilesListFile['thumbnail'];
  name: FilesListFile['name'];
  description: string;
};

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

export function FilesListItemEditable({
  file,
  fileMetadata,
  filterValue,
  activeShareMenuFileId,
  setActiveShareMenuFileId,
  lazyLoad,
  viewPreferences,
}: {
  file: FileDisplay;
  fileMetadata: NonNullable<FilesListFile['metadata']>;
  filterValue: string;
  activeShareMenuFileId: string;
  setActiveShareMenuFileId: Function;
  lazyLoad: boolean;
  viewPreferences: ViewPreferences;
}) {
  const submit = useSubmit();
  const fetcherDelete = useFetcher();
  const fetcherDownload = useFetcher();
  const fetcherDuplicate = useFetcher();
  const fetcherRename = useFetcher();
  const fetcherMove = useFetcher({ key: 'move-file:' + fileMetadata.uuid });
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [open, setOpen] = useState<boolean>(false);
  const teamRouteLoaderData = useTeamRouteLoaderData();
  const location = useLocation();
  const fileDragRef = useRef<HTMLDivElement>(null);
  const {
    teams,
    userMakingRequest: { id: userId },
  } = useDashboardRouteLoaderData();

  // If we're looking at the user's personal files OR a team where they have edit access, they can move stuff
  const isPersonalFilesRoute = location.pathname === ROUTES.FILES;
  const isTeamRoute = teamRouteLoaderData !== undefined;
  const canMoveFiles =
    isPersonalFilesRoute ||
    (isTeamRoute && teamRouteLoaderData.userMakingRequest.teamPermissions.includes('TEAM_EDIT'));

  const { name, thumbnail, description } = file;
  const { uuid, publicLinkAccess, permissions } = fileMetadata;
  const fetcherSubmitOpts: SubmitOptions = {
    method: 'POST',
    action: ROUTES.FILES_FILE(uuid),
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

  const handleDelete = () => {
    if (window.confirm(`Confirm you want to delete the file: “${name}”`)) {
      const data: FileAction['request.delete'] = {
        action: 'delete',
      };
      fetcherDelete.submit(data, fetcherSubmitOpts);
    }
  };

  const handleDownload = () => {
    const data: FileAction['request.download'] = {
      action: 'download',
    };
    fetcherDownload.submit(data, fetcherSubmitOpts);
  };

  const handleDuplicate = () => {
    const data: FileAction['request.duplicate'] = {
      action: 'duplicate',
      withCurrentOwner: true,
    };
    fetcherDuplicate.submit(data, fetcherSubmitOpts);
  };

  const handleShare = () => {
    setActiveShareMenuFileId(uuid);
    mixpanel.track('[FileSharing].menu.open', { context: 'dashboard', pathname: window.location.pathname });
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
        to={ROUTES.FILE(uuid)}
        reloadDocument
        className={cn(isDisabled && `pointer-events-none opacity-50`)}
        {...dragProps}
      >
        <ListItemView viewPreferences={viewPreferences} thumbnail={thumbnail} lazyLoad={lazyLoad}>
          <FilesListItemCore
            key={uuid}
            filterValue={filterValue}
            name={displayName}
            description={description}
            hasNetworkError={Boolean(failedToDelete || failedToRename)}
            isShared={publicLinkAccess !== 'NOT_SHARED'}
            viewPreferences={viewPreferences}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Btn variant="ghost" size="icon" className="flex-shrink-0 hover:bg-background">
                    <DotsVerticalIcon className="h-4 w-4" />
                  </Btn>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {permissions.includes('FILE_VIEW') && (
                    <DropdownMenuItem onClick={handleShare}>Share</DropdownMenuItem>
                  )}
                  {permissions.includes('FILE_EDIT') && (
                    <DropdownMenuItem onClick={handleDuplicate}>
                      {duplicateFileWithCurrentOwnerAction.label}
                    </DropdownMenuItem>
                  )}
                  {permissions.includes('FILE_EDIT') && (
                    <DropdownMenuItem onClick={() => setOpen(true)}>{renameFileAction.label}</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleDownload}>{downloadFileAction.label}</DropdownMenuItem>
                  {canMoveFiles && (
                    <>
                      <DropdownMenuSeparator />
                      {!isPersonalFilesRoute && (
                        <DropdownMenuItem
                          onClick={() => {
                            const data: FileAction['request.move'] = {
                              action: 'move',
                              ownerUserId: userId,
                            };
                            submit(data, {
                              method: 'POST',
                              action: `/files/${uuid}`,
                              encType: 'application/json',
                              navigate: false,
                              fetcherKey: `move-file:${uuid}`,
                            });
                          }}
                        >
                          Move to my files
                        </DropdownMenuItem>
                      )}
                      {teams
                        .filter(
                          ({ team, userMakingRequest: { teamPermissions } }) =>
                            team.activated &&
                            teamPermissions.includes('TEAM_EDIT') &&
                            (isTeamRoute ? teamRouteLoaderData.team.uuid !== team.uuid : true)
                        )
                        .map(({ team }) => (
                          <DropdownMenuItem
                            className="block truncate"
                            key={team.uuid}
                            onClick={() => {
                              const data: FileAction['request.move'] = {
                                action: 'move',
                                ownerTeamId: team.id,
                              };
                              submit(data, {
                                method: 'POST',
                                action: `/files/${uuid}`,
                                encType: 'application/json',
                                navigate: false,
                                fetcherKey: `move-file:${uuid}`,
                              });
                            }}
                          >
                            Move to {team.name}
                          </DropdownMenuItem>
                        ))
                        .slice(0, 2)}
                    </>
                  )}

                  {permissions.includes('FILE_DELETE') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDelete}>{deleteFile.label}</DropdownMenuItem>
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

export function FilesListItemReadOnly({
  file,
  filterValue,
  lazyLoad,
  viewPreferences,
}: {
  file: FileDisplay;
  filterValue: string;
  lazyLoad: boolean;
  viewPreferences: ViewPreferences;
}) {
  const { href, thumbnail, name, description } = file;
  return (
    <ListItem>
      <Link to={href}>
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
  return <li className="relative">{children}</li>;
}

function ListItemView({
  viewPreferences,
  thumbnail,
  lazyLoad,
  children,
}: {
  viewPreferences: ViewPreferences;
  thumbnail: FilesListFile['thumbnail'];
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
            alt="File thumbnail screenshot"
            className="object-cover"
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
    <div className={`flex flex-row items-center gap-4 py-2 hover:bg-accent lg:px-2`}>
      <div className={`hidden border border-border shadow-sm md:block`}>
        {thumbnail ? (
          <img
            loading={lazyLoad ? 'lazy' : 'eager'}
            src={thumbnail}
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

// Vanilla js time formatter. Adapted from:
// https://blog.webdevsimplified.com/2020-07/relative-time-format/
const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
  style: 'narrow',
});
const DIVISIONS: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, name: 'seconds' },
  { amount: 60, name: 'minutes' },
  { amount: 24, name: 'hours' },
  { amount: 7, name: 'days' },
  { amount: 4.34524, name: 'weeks' },
  { amount: 12, name: 'months' },
  { amount: Number.POSITIVE_INFINITY, name: 'years' },
];
export function timeAgo(dateString: string) {
  const date: Date = new Date(dateString);

  let duration = (date.getTime() - new Date().getTime()) / 1000;

  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
}
