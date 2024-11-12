import { createNewFileAction, deleteFile, duplicateFileAction } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { editorInteractionStateUserAtom, editorInteractionStateUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { DeleteIcon, DraftIcon, FileCopyIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from '@/shared/shadcn/ui/menubar';
import { Link, useSubmit } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

// TODO: (enhancement) move these into `fileActionsSpec` by making the `.run()`
// function of each accessible from outside of react

export const FileMenubarMenu = () => {
  const { name } = useFileContext();
  const submit = useSubmit();

  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const uuid = useRecoilValue(editorInteractionStateUuidAtom);
  const user = useRecoilValue(editorInteractionStateUserAtom);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const isAvailableArgs = useIsAvailableArgs();

  if (!isAuthenticated) return null;

  return (
    <MenubarMenu>
      <MenubarTrigger>File</MenubarTrigger>
      <MenubarContent className="pointer-move-ignore">
        {createNewFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem asChild>
            <Link to={ROUTES.CREATE_FILE_PRIVATE(teamUuid)} reloadDocument>
              <DraftIcon />
              {createNewFileAction.label}
            </Link>
          </MenubarItem>
        )}
        {duplicateFileAction.isAvailable(isAvailableArgs) && (
          <MenubarItem onClick={() => duplicateFileAction.run({ uuid, submit })}>
            <FileCopyIcon />
            Duplicate
          </MenubarItem>
        )}

        <MenubarSeparator />

        <MenubarItemAction action={Action.FileShare} actionArgs={undefined} />
        <MenubarItemAction action={Action.FileRename} actionArgs={undefined} />
        <MenubarItemAction action={Action.FileDownload} actionArgs={{ name }} />

        <MenubarSeparator />

        {deleteFile.isAvailable(isAvailableArgs) && (
          <MenubarItem
            onClick={() =>
              deleteFile.run({ uuid, userEmail: user?.email ?? '', redirect: true, submit, addGlobalSnackbar })
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
