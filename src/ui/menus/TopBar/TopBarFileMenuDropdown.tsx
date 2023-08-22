import { KeyboardArrowDown } from '@mui/icons-material';
import { Divider, IconButton, Menu, MenuItem, useTheme } from '@mui/material';
import { Dispatch, SetStateAction, useState } from 'react';
import { useParams, useSubmit } from 'react-router-dom';
import { apiClient } from '../../../api/apiClient';
import { ROUTES } from '../../../constants/routes';
import { GridFileSchema } from '../../../schemas';
import { useFileContext } from '../../components/FileProvider';

export function TopBarFileMenuDropdown({ setIsRenaming }: { setIsRenaming: Dispatch<SetStateAction<boolean>> }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const { name, contents, downloadFile } = useFileContext();
  const { uuid } = useParams() as { uuid: string };
  const submit = useSubmit();

  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

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
            setIsRenaming(true);
            handleClose();
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          dense
          onClick={() => {
            downloadFile();
            handleClose();
          }}
        >
          Download local copy
        </MenuItem>
        <Divider />
        <MenuItem
          dense
          onClick={async () => {
            // Confirm user wants to do it
            if (window.confirm(`Please confirm you want to delete the file: “${name}”`)) {
              // TODO a couple options for async operations on the sheet:
              // 1. just assume it'll delete (and it'll show up in the file list if it didn't?)
              // 2. Use local state and await it here, then navigate
              // 3. Create routes for use by fetchers when in the sheet, e.g. `/file/:uuid/delete`
              //    with a top-level "loading" effect on the entire sheet when we do these kinds of things
              apiClient.deleteFile(uuid);
              window.location.href = ROUTES.FILES;
            }
            handleClose();
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}
