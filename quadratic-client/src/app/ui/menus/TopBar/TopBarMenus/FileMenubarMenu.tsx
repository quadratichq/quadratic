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
import { useConfirmDialog } from '@/shared/components/ConfirmProvider';
import { DeleteIcon, DraftIcon, ExternalLinkIcon, FileCopyIcon, FileOpenIcon } from '@/shared/components/Icons';
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
import type { RecentFile } from '@/shared/utils/updateRecentFiles';
import { clearRecentFiles, RECENT_FILES_KEY } from '@/shared/utils/updateRecentFiles';
import { useMemo } from 'react';
import { useSubmit } from 'react-router';
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
  const confirmFn = useConfirmDialog('deleteFile', { name });
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
            <ExternalLinkIcon className="ml-auto !h-4 !w-4 text-center !text-xs text-muted-foreground opacity-50" />
          </MenubarItem>
        )}
        {duplicateFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => duplicateFileAction.run({ fileUuid })}>
            <FileCopyIcon />
            Duplicate
            <ExternalLinkIcon className="ml-auto !h-4 !w-4 text-center !text-xs text-muted-foreground opacity-50" />
          </MenubarItem>
        )}
        <MenubarItemAction action={Action.FileVersionHistory} actionArgs={{ uuid: fileUuid }} />

        {recentFilesMenuItems}

        <MenubarSeparator />

        <MenubarItemAction action={Action.FileShare} actionArgs={undefined} />
        <MenubarItemAction action={Action.FileRename} actionArgs={undefined} />
        <MenubarItemAction action={Action.FileDownload} actionArgs={{ name, uuid: fileUuid }} />

        <MenubarSeparator />

        {deleteFile.isAvailable(isAvailableArgs) && (
          <MenubarItem
            onClick={() =>
              deleteFile.run({
                fileUuid,
                userEmail: user?.email ?? '',
                redirect: true,
                submit,
                confirmFn,
              })
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
