import { KeyboardArrowDown } from '@mui/icons-material';
import { IconButton, useTheme } from '@mui/material';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import type { Dispatch, SetStateAction } from 'react';
import { useParams, useSubmit } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

import { deleteFile, downloadFileAction, duplicateFileAction, renameFileAction } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { MenuLineItem } from '@/app/ui/menus/TopBar/MenuLineItem';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';

export function TopBarFileMenuDropdown({ setIsRenaming }: { setIsRenaming: Dispatch<SetStateAction<boolean>> }) {
  const theme = useTheme();
  const { name } = useFileContext();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { uuid } = useParams() as { uuid: string };
  const submit = useSubmit();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions },
  } = useFileRouteLoaderData();
  const { permissions } = editorInteractionState;

  if (!isAuthenticated) {
    return null;
  }

  const isAvailableArgs = { filePermissions: permissions, fileTeamPrivacy, isAuthenticated, teamPermissions };

  return (
    <Menu
      menuButton={({ open }) => (
        <IconButton
          id="file-name-button"
          aria-controls={open ? 'basic-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          size="small"
          disableRipple
          sx={{
            marginLeft: theme.spacing(-0.5),
            fontSize: '1rem',
            ...(open
              ? {
                  backgroundColor: theme.palette.action.hover,
                  '& svg': { transform: 'translateY(1px)' },
                }
              : {}),
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
            '&:hover svg': {
              transform: 'translateY(1px)',
            },
          }}
        >
          <KeyboardArrowDown fontSize="inherit" sx={{ transition: '.2s ease transform' }} />
        </IconButton>
      )}
    >
      {renameFileAction.isAvailable(isAvailableArgs) && (
        <MenuItem
          onClick={() => {
            setIsRenaming(true);
          }}
        >
          <MenuLineItem primary={renameFileAction.label} />
        </MenuItem>
      )}
      {duplicateFileAction.isAvailable(isAvailableArgs) && (
        <MenuItem onClick={() => duplicateFileAction.run({ uuid, submit })}>
          <MenuLineItem primary={duplicateFileAction.label} />
        </MenuItem>
      )}
      {downloadFileAction.isAvailable(isAvailableArgs) && (
        <MenuItem
          onClick={() => {
            downloadFileAction.run({ name });
          }}
        >
          <MenuLineItem primary={downloadFileAction.label} />
        </MenuItem>
      )}
      {deleteFile.isAvailable(isAvailableArgs) && (
        <>
          <MenuDivider />
          <MenuItem
            onClick={async () => {
              deleteFile.run({ uuid, addGlobalSnackbar });
            }}
          >
            <MenuLineItem primary={deleteFile.label} />
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
