import { KeyboardArrowDown } from '@mui/icons-material';
import { IconButton, useTheme } from '@mui/material';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { Dispatch, SetStateAction, useState } from 'react';
import { useParams, useSubmit } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { apiClient } from '../../../api/apiClient';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../../constants/routes';
import { GridFileSchema } from '../../../schemas';
import { useFileContext } from '../../components/FileProvider';
import { MenuLineItem } from './MenuLineItem';

export function TopBarFileMenuDropdown({ setIsRenaming }: { setIsRenaming: Dispatch<SetStateAction<boolean>> }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const { name, contents, downloadFile } = useFileContext();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { uuid } = useParams() as { uuid: string };
  const submit = useSubmit();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { permission } = editorInteractionState;

  const isOwner = permission === 'OWNER';
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  if (permission === 'ANONYMOUS') {
    return null;
  }

  // TODO only duplicate and download should show up for people without edit access

  return (
    <Menu
      menuButton={
        <IconButton
          id="file-name-button"
          aria-controls={open ? 'basic-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={handleClick}
          size="small"
          sx={{ marginLeft: theme.spacing(-0.5), fontSize: '1rem' }}
        >
          <KeyboardArrowDown fontSize="inherit" />
        </IconButton>
      }
    >
      {isOwner && (
        <MenuItem
          onClick={() => {
            handleClose();
            setIsRenaming(true);
          }}
        >
          <MenuLineItem primary="Rename" />
        </MenuItem>
      )}
      <MenuItem
        onClick={() => {
          handleClose();
          // TODO this is async and needs to disable button or something
          let formData = new FormData();
          formData.append('name', name + ' (Copy)');
          formData.append('contents', JSON.stringify(contents));
          formData.append('version', GridFileSchema.shape.version.value);
          submit(formData, { method: 'POST', action: ROUTES.CREATE_FILE });
        }}
      >
        <MenuLineItem primary="Duplicate" />
      </MenuItem>
      <MenuItem
        onClick={() => {
          handleClose();
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
              handleClose();
              // Give the UI a chance to update and close the menu before triggering alert
              setTimeout(async () => {
                if (window.confirm(`Please confirm you want to delete the file: “${name}”`)) {
                  try {
                    await apiClient.deleteFile(uuid);
                    window.location.href = ROUTES.FILES;
                  } catch (e) {
                    addGlobalSnackbar('Failed to delete file. Try again.', { severity: 'error' });
                  }
                }
              }, 200);
            }}
          >
            <MenuLineItem primary="Delete" />
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
