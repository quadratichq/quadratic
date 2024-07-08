import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderData } from '@/routes/file.$uuid';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { focusGrid } from '../../../helpers/focusGrid';
import { useFileContext } from '../../components/FileProvider';
import { TopBarFileMenuDropdown } from './TopBarFileMenuDropdown';

export const TopBarFileMenu = () => {
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const { name } = useFileContext();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { permissions } = editorInteractionState;

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
                    className={`hidden max-w-[25vw] truncate md:block`}
                    onClick={() => {
                      setIsRenaming(true);
                    }}
                  >
                    {name}
                  </button>
                  <span className={`block max-w-[25vw] truncate md:hidden`}>{name}</span>
                </>
              ) : (
                <span className={`block max-w-[25vw] truncate`}>{name}</span>
              )}
            </Type>

            <div className="hidden md:block">
              <TopBarFileMenuDropdown setIsRenaming={setIsRenaming} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function FileLocation() {
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    team,
    userMakingRequest: { fileRelativeLocation },
  } = useFileRouteLoaderData();
  const linkProps = {
    reloadDocument: true,
    className: 'underline:none text-inherit block max-w-40 truncate',
  };

  // Don't show anything if they're not logged in
  if (!isAuthenticated) {
    return null;
  }

  // Figure out the user's relationship to the file and the link back to its
  // location in the dashboard
  let DashboardLink;
  if (fileRelativeLocation === 'TEAM_PUBLIC') {
    DashboardLink = (
      <Link to={ROUTES.TEAM(team.uuid)} {...linkProps} title={team.name}>
        {team.name}
      </Link>
    );
  } else if (fileRelativeLocation === 'TEAM_PRIVATE') {
    DashboardLink = (
      <Link to={ROUTES.TEAM_FILES_PRIVATE(team.uuid)} {...linkProps} title="Private files">
        Private
      </Link>
    );
  }

  // They must be seeing the file because the public link is being used
  if (!DashboardLink) {
    return null;
  }

  return (
    <>
      <Type className="hidden text-muted-foreground hover:text-foreground hover:underline md:block">
        {DashboardLink}
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
      className="w-full text-center text-sm outline-none"
    />
  );
}
