import { KeyboardArrowDown } from '@mui/icons-material';
import { IconButton, useTheme } from '@mui/material';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { Dispatch, SetStateAction } from 'react';
import { useParams, useSubmit } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { duplicateFile, isViewerOrAbove } from '../../../actions';
import { apiClient } from '../../../api/apiClient';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../../constants/routes';
import { useFileContext } from '../../components/FileProvider';
import { MenuLineItem } from './MenuLineItem';

export function TopBarFileMenuDropdown({ setIsRenaming }: { setIsRenaming: Dispatch<SetStateAction<boolean>> }) {
  const theme = useTheme();
  const { name, contents, downloadFile } = useFileContext();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { uuid } = useParams() as { uuid: string };
  const submit = useSubmit();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { permission } = editorInteractionState;

  const isOwner = permission === 'OWNER';

  if (!isViewerOrAbove(permission)) {
    return null;
  }

  // TODO only duplicate and download should show up for people without edit access

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
      {isOwner && (
        <MenuItem
          onClick={() => {
            setIsRenaming(true);
          }}
        >
          <MenuLineItem primary="Rename" />
        </MenuItem>
      )}
      {duplicateFile.isAvailable(permission) && (
        <MenuItem onClick={() => duplicateFile.run({ contents, name, submit })}>
          <MenuLineItem primary={duplicateFile.label} />
        </MenuItem>
      )}
      <MenuItem
        onClick={() => {
          downloadFile();
        }}
      >
        <MenuLineItem primary="Download local copy" />
      </MenuItem>
      {isOwner && (
        <>
          <MenuDivider />
          <MenuItem
            onClick={async () => {
              if (window.confirm(`Please confirm you want to delete the file: “${name}”`)) {
                try {
                  await apiClient.deleteFile(uuid);
                  window.location.href = ROUTES.FILES;
                } catch (e) {
                  addGlobalSnackbar('Failed to delete file. Try again.', { severity: 'error' });
                }
              }
            }}
          >
            <MenuLineItem primary="Delete" />
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
