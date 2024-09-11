import { createNewFileAction, deleteFile, downloadFileAction, duplicateFileAction } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { DeleteIcon, DownloadIcon, DraftIcon, FileCopyIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from '@/shared/shadcn/ui/menubar';
import { useSubmit } from 'react-router-dom';
import { useRecoilState } from 'recoil';

// TODO: (enhancement) move these into `fileActionsSpec` by making the `.run()`
// function of each accessible from outside of react

export const FileMenubarMenu = () => {
  const { name } = useFileContext();
  const submit = useSubmit();
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions },
    file: { uuid: fileUuid },
  } = useFileRouteLoaderData();
  const { permissions } = editorInteractionState;
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const isAvailableArgs = { filePermissions: permissions, fileTeamPrivacy, isAuthenticated, teamPermissions };

  if (!isAuthenticated) return null;

  return (
    <MenubarMenu>
      <MenubarTrigger>File</MenubarTrigger>
      <MenubarContent>
        {createNewFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => createNewFileAction.run({ setEditorInteractionState })}>
            <DraftIcon /> {createNewFileAction.label}
          </MenubarItem>
        )}
        {duplicateFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => duplicateFileAction.run({ uuid: fileUuid, submit })}>
            <FileCopyIcon />
            Duplicate
          </MenubarItem>
        )}

        <MenubarSeparator />

        <MenubarItemAction action={Action.FileShare} actionArgs={undefined} />
        <MenubarItemAction action={Action.FileRename} actionArgs={undefined} />
        {downloadFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => downloadFileAction.run({ name })}>
            <DownloadIcon /> Download
          </MenubarItem>
        )}

        <MenubarSeparator />

        {deleteFile.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => deleteFile.run({ uuid: fileUuid, addGlobalSnackbar })}>
            <DeleteIcon />
            Delete
          </MenubarItem>
        )}
      </MenubarContent>
    </MenubarMenu>
  );
};
