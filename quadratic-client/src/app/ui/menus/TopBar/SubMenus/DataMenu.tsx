import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useSetRecoilState } from 'recoil';

import { downloadSelectionAsCsvAction, isAvailableBecauseFileLocationIsAccessibleAndWriteable } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { openCodeEditor } from '@/app/grid/actions/openCodeEditor';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { DataIcon } from '@/app/ui/icons';
import { MenuLineItem } from '@/app/ui/menus/TopBar/MenuLineItem';
import { TopBarMenuItem } from '@/app/ui/menus/TopBar/TopBarMenuItem';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CSV_IMPORT_MESSAGE, PARQUET_IMPORT_MESSAGE } from '@/shared/constants/appConstants';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';

export const DataMenu = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { name: fileName } = useFileContext();
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { filePermissions, fileTeamPrivacy, teamPermissions },
  } = useFileRouteLoaderData();
  const showManageConnections = isAvailableBecauseFileLocationIsAccessibleAndWriteable({
    isAuthenticated,
    filePermissions,
    fileTeamPrivacy,
    teamPermissions,
  });

  return (
    <>
      <Menu
        menuButton={({ open }) => (
          <TopBarMenuItem title="Data" open={open}>
            <DataIcon fontSize="small" />
          </TopBarMenuItem>
        )}
      >
        <MenuItem onClick={openCodeEditor}>
          <MenuLineItem primary="Open Code Editor" secondary={'/'} />
        </MenuItem>
        <MenuDivider />
        <MenuItem
          onClick={() => {
            addGlobalSnackbar(CSV_IMPORT_MESSAGE);
          }}
        >
          <MenuLineItem primary="Import from CSV" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            addGlobalSnackbar(PARQUET_IMPORT_MESSAGE);
          }}
        >
          <MenuLineItem primary="Import from Parquet" />
        </MenuItem>
        <MenuDivider />
        <MenuItem
          onClick={() => {
            setEditorInteractionState((prev) => ({ ...prev, showCellTypeMenu: true }));
          }}
        >
          <MenuLineItem primary="Use a connection" />
        </MenuItem>
        {showManageConnections && (
          <>
            <MenuItem onClick={() => setEditorInteractionState((prev) => ({ ...prev, showConnectionsMenu: true }))}>
              <MenuLineItem primary="Manage connections" />
            </MenuItem>
          </>
        )}

        <MenuDivider />
        <MenuItem
          onClick={() => {
            downloadSelectionAsCsvAction.run({ fileName });
          }}
        >
          <MenuLineItem
            primary={downloadSelectionAsCsvAction.label}
            secondary={KeyboardSymbols.Command + KeyboardSymbols.Shift + 'E'}
          />
        </MenuItem>
      </Menu>
    </>
  );
};
