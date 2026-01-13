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
    // My private file
    const label = 'Private';
    dashboardLink = isEmbed ? (
      label
    ) : (
      <Link to={ROUTES.TEAM_FILES_PRIVATE(team.uuid)} {...linkProps} data-testid="file-location-link-my-files">
        {label}
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
      ></Link>
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
      <Type className="hidden text-muted-foreground md:block">{dashboardLink}</Type>

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
