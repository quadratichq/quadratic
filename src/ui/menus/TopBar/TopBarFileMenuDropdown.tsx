import { KeyboardArrowDown } from '@mui/icons-material';
import { Divider, IconButton, Menu, MenuItem, useTheme } from '@mui/material';
import { Dispatch, SetStateAction, useState } from 'react';
import { useParams, useSubmit } from 'react-router-dom';
import { apiClient } from '../../../api/apiClient';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbar';
import { ROUTES } from '../../../constants/routes';
import { GridFileSchema } from '../../../schemas';
import { useFileContext } from '../../components/FileProvider';

export function TopBarFileMenuDropdown({ setIsRenaming }: { setIsRenaming: Dispatch<SetStateAction<boolean>> }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const { name, contents, downloadFile } = useFileContext();
  const { uuid } = useParams() as { uuid: string };
  const submit = useSubmit();
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  // TODO only duplicate and download should show up for people without edit access

  return (
    <>
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
      <Menu
        id="file-name-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'file-name-button',
        }}
      >
        <MenuItem
          dense
          onClick={() => {
            handleClose();
            setIsRenaming(true);
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          dense
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
          Duplicate
        </MenuItem>
        <MenuItem
          dense
          onClick={() => {
            handleClose();
            downloadFile();
          }}
        >
          Download local copy
        </MenuItem>
        <Divider />
        <MenuItem
          dense
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
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}
