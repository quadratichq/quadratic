import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { ConnectionStatusIcon } from '@/app/ui/menus/TopBar/ConnectionStatusIcon';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useTeamData } from '@/shared/hooks/useTeamData';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useRecoilValue } from 'recoil';

export const TopBarFileNameAndLocationMenu = () => {
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const { name } = useFileContext();
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);

  return (
    <div className={`flex flex-grow items-center justify-center`}>
      {isRenaming ? (
        <FileNameInput setIsRenaming={setIsRenaming} />
      ) : (
        <div className={`flex flex-row items-center gap-2`}>
          <FileLocation />

          <div className={`flex flex-row items-center gap-2`}>
            <Type variant="body2">
              {hasPermissionToEditFile(permissions) ? (
                <>
                  <button
                    className={`hidden max-w-[35vw] truncate md:block`}
                    onClick={() => {
                      setIsRenaming(true);
                    }}
                  >
                    {name}
                  </button>

                  <span className={`block max-w-[50vw] truncate md:hidden`}>{name}</span>
                </>
              ) : (
                <span className={`block max-w-[50vw] truncate`}>{name}</span>
              )}
            </Type>
            {!isEmbed && <ConnectionStatusIcon />}
          </div>
        </div>
      )}
    </div>
  );
};

function FileLocation() {
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    file: { ownerUserId },
    team,
    userMakingRequest: { fileRole, teamRole, id: userId },
  } = useFileRouteLoaderData();
  // Use useTeamData for reactive team name updates
  const { teamData } = useTeamData();
  const teamName = teamData?.activeTeam?.team.name ?? team.name;
  const [fileType, setFileType] = useState<'team' | 'personal'>('team');

  const linkProps = {
    reloadDocument: true,
    className: 'hover:text-foreground hover:underline block max-w-40 truncate',
  };

  // Don't show anything if they're not logged in
  if (!isAuthenticated) {
    return null;
  }

  // Determine where the file is located and where we link back to
  // But don't allow links in embed mode (file history, etc.)
  let dashboardLink = null;
  if (ownerUserId && ownerUserId === userId) {
    dashboardLink = isEmbed ? (
      teamName
    ) : (
      <Link to={ROUTES.TEAM_FILES(team.uuid)} {...linkProps} data-testid="file-location-link-team-files">
        {teamName}
      </Link>
    );
  } else if (ownerUserId === undefined && teamRole) {
    // Team file
    dashboardLink = isEmbed ? (
      teamName
    ) : (
      <Link to={ROUTES.TEAM_FILES(team.uuid)} {...linkProps} data-testid="file-location-link-team-files">
        {teamName}
      </Link>
    );
  } else if (fileRole) {
    // File i was invited to
    const label = 'Shared with me';
    dashboardLink = isEmbed ? (
      label
    ) : (
      <Link
        to={ROUTES.TEAM_FILES_SHARED_WITH_ME(team.uuid)}
        {...linkProps}
        data-testid="file-location-link-shared-with-me"
      >
        {label}
      </Link>
    );
  }

  // They must be seeing the file because the public link is being used
  if (dashboardLink === null) {
    return null;
  }

  return (
    <>
      <Type className="hidden text-muted-foreground md:flex md:items-center">
        {dashboardLink}
        {/* TODO: if user is view-only member, don't allow switching. Also fix: Shared with me (Team) */}
        {teamRole === 'VIEWER' ? (
          `(${fileType})`
        ) : teamRole === 'EDITOR' || teamRole === 'OWNER' ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-1 flex h-6 items-center !bg-background font-normal capitalize">
              ({fileType})
            </DropdownMenuTrigger>
            <DropdownMenuContent
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                focusGrid();
              }}
            >
              <DropdownMenuCheckboxItem
                disabled={fileType === 'team'}
                checked={fileType === 'team'}
                onCheckedChange={(checked) => {
                  setFileType(checked ? 'team' : 'personal');
                }}
              >
                Team file
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                disabled={fileType === 'personal'}
                checked={fileType === 'personal'}
                onCheckedChange={(checked) => {
                  setFileType(checked ? 'personal' : 'team');
                }}
              >
                Personal file
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                inset
                onClick={() => {
                  window.location.href = ROUTES.TEAM_SETTINGS(team.uuid);
                }}
              >
                Manage team…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </Type>

      <Type variant="body2" className="hidden select-none text-muted-foreground opacity-50 md:block">
        /
      </Type>
    </>
  );
}

function FileNameInput({ setIsRenaming }: { setIsRenaming: Dispatch<SetStateAction<boolean>> }) {
  const { name, renameFile } = useFileContext();
  const inputRef = useRef<HTMLInputElement>(null);

  // When user selects input, highlight it's contents
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setSelectionRange(0, inputRef.current.value.length);
    }
  }, []);

  return (
    <input
      onKeyUp={(e) => {
        if (e.key === 'Enter') {
          inputRef.current?.blur();
          focusGrid();
        } else if (e.key === 'Escape') {
          if (inputRef.current) {
            inputRef.current.value = name;
            inputRef.current.blur();
          }
          focusGrid();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
        setIsRenaming(false);
        const newName = inputRef.current?.value;

        // Don't allow empty file names
        if (!(newName && newName.trim())) {
          return;
        }

        // Don't do anything if the name didn't change
        if (newName === name) {
          return;
        }

        renameFile(newName);
      }}
      defaultValue={name}
      ref={inputRef}
      autoFocus
      className="w-full bg-transparent text-center text-sm text-foreground outline-none"
    />
  );
}
