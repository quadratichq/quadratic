import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { ConnectionStatusIcon } from '@/app/ui/menus/TopBar/ConnectionStatusIcon';
import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import { ExternalLinkIcon, MoveItemIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useTeamData } from '@/shared/hooks/useTeamData';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
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
  const { uuid } = useParams() as { uuid: string };
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    file: { ownerUserId },
    team,
    userMakingRequest: { fileRole, teamRole, id: userId },
  } = useFileRouteLoaderData();
  // Use useTeamData for reactive team name updates
  const { teamData } = useTeamData();
  const teamName = teamData?.activeTeam?.team.name ?? team.name;

  // Determine current file location based on ownerUserId:
  //   1. You have access to the team and its your file: personal
  //   2. You have access to the team but its not your file: team
  //   3. You don't have access to the team but file was shared via link: "Untitled"
  //   4. You don't have access to the team but you were invited to the file: "Shared with me / Untitled"
  const [fileType, setFileType] = useState<'team' | 'personal' | 'shared-invite' | 'shared-link'>(
    ownerUserId !== undefined && ownerUserId === userId
      ? 'personal'
      : ownerUserId === undefined && teamRole
        ? 'team'
        : fileRole
          ? 'shared-invite'
          : 'shared-link'
  );
  console.log('fileType', fileType, ownerUserId, userId, teamRole, fileRole);

  const moveFile = useCallback(
    async (newFileType: 'team' | 'personal') => {
      if (!userId) return;

      const previousFileType = fileType;

      // Optimistically update the UI
      setFileType(newFileType);

      try {
        await apiClient.files.update(uuid, { ownerUserId: newFileType === 'personal' ? userId : null });
      } catch (error) {
        // Revert on failure
        setFileType(previousFileType);
        console.error('Failed to move file:', error);
      }
    },
    [uuid, userId, fileType]
  );

  // Don't show anything if they're not logged in
  if (!isAuthenticated) {
    return null;
  }

  // Determine where the file is located and where we link back to
  // But don't allow links in embed mode (file history, etc.)
  let teamElement = null;
  if (fileType === 'personal') {
    const label = (
      <>
        <span className="block max-w-40 truncate">{teamName}</span> (Personal)
      </>
    );
    teamElement = isEmbed ? (
      label
    ) : teamRole === 'VIEWER' ? (
      <Link
        to={ROUTES.TEAM_FILES_PRIVATE(team.uuid)}
        reloadDocument
        className={'flex items-center gap-1 hover:text-foreground hover:underline'}
      >
        {label}
      </Link>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 hover:text-foreground">{label}</DropdownMenuTrigger>
        <DropdownMenuContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            focusGrid();
          }}
        >
          <DropdownMenuItem asChild>
            <Link to={ROUTES.TEAM_FILES_PRIVATE(team.uuid)} reloadDocument className="no-underline">
              <ExternalLinkIcon className="mr-2" />
              View personal files
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => moveFile('team')}>
            <MoveItemIcon className="mr-2" />
            Move to team files
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } else if (fileType === 'team') {
    const label = (
      <>
        <span className="block max-w-40 truncate">{teamName}</span> (Team)
      </>
    );
    teamElement = isEmbed ? (
      label
    ) : teamRole === 'VIEWER' ? (
      <Link
        to={ROUTES.TEAM_FILES(team.uuid, { type: 'team' })}
        reloadDocument
        className={'flex items-center gap-1 hover:text-foreground hover:underline'}
      >
        {label}
      </Link>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 hover:text-foreground">{label}</DropdownMenuTrigger>
        <DropdownMenuContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            focusGrid();
          }}
        >
          <DropdownMenuItem asChild>
            <Link to={ROUTES.TEAM_FILES(team.uuid, { type: 'team' })} reloadDocument className="no-underline">
              <ExternalLinkIcon className="mr-2" />
              View team files
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => moveFile('personal')}>
            <MoveItemIcon className="mr-2" />
            Move to personal files
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } else if (fileType === 'shared-invite') {
    const label = 'Shared with me';
    teamElement = isEmbed ? (
      label
    ) : (
      <Link
        to={ROUTES.TEAM_FILES_SHARED_WITH_ME(team.uuid)}
        reloadDocument
        className="block max-w-40 truncate"
        data-testid="file-location-link-shared-with-me"
      >
        {label}
      </Link>
    );
  }

  // They must be seeing the file because the public link is being used
  if (teamElement === null) {
    return null;
  }

  return (
    <>
      <Type className="hidden text-muted-foreground md:block">{teamElement}</Type>

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
