import { createNewFileAction, deleteFile, duplicateFileAction } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateTeamUuidAtom,
  editorInteractionStateUserAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { DeleteIcon, DraftIcon, FileCopyIcon, FileOpenIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/shared/shadcn/ui/menubar';
import { clearRecentFiles, RECENT_FILES_KEY, RecentFile } from '@/shared/utils/updateRecentFiles';
import { useMemo } from 'react';
import { useSubmit } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

// TODO: (enhancement) move these into `fileActionsSpec` by making the `.run()`
// function of each accessible from outside of react

export const FileMenubarMenu = () => {
  const { name } = useFileContext();
  const submit = useSubmit();

  const { isAuthenticated } = useRootRouteLoaderData();
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const user = useRecoilValue(editorInteractionStateUserAtom);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const isAvailableArgs = useIsAvailableArgs();

  const [recentFiles] = useLocalStorage<RecentFile[]>(RECENT_FILES_KEY, []);
  const recentFilesMenuItems = useMemo(() => {
    if (recentFiles.length <= 1) return null;

    return (
      <>
        <MenubarSeparator />
        <MenubarSub>
          <MenubarSubTrigger>
            <FileOpenIcon /> Open recent
          </MenubarSubTrigger>
          <MenubarSubContent>
            {recentFiles
              .filter((file) => file.uuid !== fileUuid && file.name.trim().length > 0)
              .map((file) => (
                <MenubarItem
                  onClick={() => {
                    window.location.href = ROUTES.FILE(file.uuid);
                  }}
                  key={file.uuid}
                >
                  {file.name}
                </MenubarItem>
              ))}
            <MenubarSeparator />
            <MenubarItem onClick={clearRecentFiles}>Clear</MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
      </>
    );
  }, [fileUuid, recentFiles]);

  if (!isAuthenticated) return null;

  return (
    <MenubarMenu>
      <MenubarTrigger>File</MenubarTrigger>
      <MenubarContent className="pointer-move-ignore">
        {createNewFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => createNewFileAction.run({ teamUuid })}>
            <DraftIcon />
            {createNewFileAction.label}
          </MenubarItem>
        )}
        {duplicateFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => duplicateFileAction.run({ fileUuid, submit })}>
            <FileCopyIcon />
            Duplicate
          </MenubarItem>
        )}

        {recentFilesMenuItems}

        <MenubarSeparator />

        <MenubarItemAction action={Action.FileShare} actionArgs={undefined} />
        <MenubarItemAction action={Action.FileRename} actionArgs={undefined} />
        <MenubarItemAction action={Action.FileDownload} actionArgs={{ name }} />

        <MenubarSeparator />

        {deleteFile.isAvailable(isAvailableArgs) && (
          <MenubarItem
            onClick={() =>
              deleteFile.run({ fileUuid, userEmail: user?.email ?? '', redirect: true, submit, addGlobalSnackbar })
            }
          >
            <DeleteIcon />
            Delete
          </MenubarItem>
        )}
      </MenubarContent>
    </MenubarMenu>
  );
};
