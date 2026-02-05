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
import { moveFile, useFileLocation } from '@/shared/atom/fileLocationAtom';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import {
  DeleteIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileCopyIcon,
  FileIcon,
  FileOpenIcon,
  MoveItemIcon,
} from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
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
import { RECENT_FILES_KEY } from '@/shared/utils/updateRecentFiles';
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
  const isAvailableArgs = useIsAvailableArgs();
  const { ownerUserId } = useFileLocation();
  const {
    userMakingRequest: { id: userId, filePermissions },
  } = useFileRouteLoaderData();

  const canMoveFile = filePermissions.includes('FILE_MOVE');
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const [recentFiles, setRecentFiles] = useLocalStorage<RecentFile[]>(RECENT_FILES_KEY, []);
  const recentFilesWithoutCurrentFile = useMemo(
    () => recentFiles.filter((file) => file.uuid !== fileUuid && file.name.trim().length > 0),
    [recentFiles, fileUuid]
  );

  if (!isAuthenticated) return null;

  return (
    <MenubarMenu>
      <MenubarTrigger>File</MenubarTrigger>
      <MenubarContent className="pointer-move-ignore">
        {createNewFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => createNewFileAction.run({ teamUuid })}>
            <FileIcon />
            {createNewFileAction.label}
            <ExternalLinkIcon className="ml-auto !h-4 !w-4 text-center !text-xs text-muted-foreground opacity-50" />
          </MenubarItem>
        )}
        {duplicateFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => duplicateFileAction.run({ fileUuid })}>
            <FileCopyIcon />
            Duplicate to personal files
            <ExternalLinkIcon className="ml-auto !h-4 !w-4 text-center !text-xs text-muted-foreground opacity-50" />
          </MenubarItem>
        )}
        <MenubarItemAction action={Action.FileVersionHistory} actionArgs={{ uuid: fileUuid }} />

        {recentFilesWithoutCurrentFile.length > 0 && (
          <>
            <MenubarSeparator />
            <MenubarSub>
              <MenubarSubTrigger>
                <FileOpenIcon /> Open recent
              </MenubarSubTrigger>
              <MenubarSubContent>
                {recentFilesWithoutCurrentFile.map((file) => (
                  <MenubarItem
                    onClick={() => {
                      window.location.href = ROUTES.FILE({ uuid: file.uuid, searchParams: '' });
                    }}
                    key={file.uuid}
                  >
                    {file.name}
                  </MenubarItem>
                ))}
                <MenubarSeparator />
                <MenubarItem onClick={() => setRecentFiles([])}>Clear</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </>
        )}

        <MenubarSeparator />

        <MenubarItemAction action={Action.FileShare} actionArgs={undefined} />
        <MenubarItemAction action={Action.FileRename} actionArgs={undefined} />

        {canMoveFile && ownerUserId === null && (
          <MenubarItem onClick={() => userId && moveFile(fileUuid, userId, addGlobalSnackbar)}>
            <MoveItemIcon />
            Move to personal files
          </MenubarItem>
        )}
        {canMoveFile && ownerUserId !== null && (
          <MenubarItem onClick={() => moveFile(fileUuid, null, addGlobalSnackbar)}>
            <MoveItemIcon />
            Move to team files
          </MenubarItem>
        )}

        <MenubarSub>
          <MenubarSubTrigger>
            <DownloadIcon /> Download
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.FileDownload} actionArgs={{ name, uuid: fileUuid }} />
            <MenubarItemAction action={Action.FileDownloadExcel} actionArgs={{ name, uuid: fileUuid }} />
            <MenubarSeparator />
            <MenubarItemAction action={Action.FileDownloadCsv} actionArgs={{ name, uuid: fileUuid }} />
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />

        {deleteFile.isAvailable(isAvailableArgs) && (
          <MenubarItem
            onClick={() =>
              deleteFile.run({
                fileUuid,
                userEmail: user?.email ?? '',
                redirect: true,
                submit,
              })
            }
          >
            <DeleteIcon />
            Delete
          </MenubarItem>
        )}

        <MenubarSeparator />
        <MenubarItemAction action={Action.HelpSettings} actionArgs={undefined} shortcutOverride="" />
      </MenubarContent>
    </MenubarMenu>
  );
};
