import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Grow from '@mui/material/Grow';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import * as React from 'react';
import { Link, useNavigation, useSubmit } from 'react-router-dom';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../constants/routes';
import { validateAndUpgradeGridFile } from '../../schemas/validateAndUpgradeGridFile';
import { CreateActionRequest } from '../files/CreateRoute';

// TODO this will need props when it becomes a button that can be used
// on the team page as well as the user's files page
export default function CreateFileButton() {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isDisabled = navigation.state !== 'idle';

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setOpen(false);

    // If nothing was selected, just exit
    if (!e.target.files) {
      return;
    }

    // Get the file and it's contents
    const file: File = e.target.files[0];
    const contents = await file.text().catch((e) => null);

    // Ensure it's a valid Quadratic grid file
    const validFile = await validateAndUpgradeGridFile(contents);
    if (!validFile) {
      addGlobalSnackbar('Import failed: invalid `.grid` file.', { severity: 'error' });
      return;
    }

    // Upload it
    const data: CreateActionRequest = {
      name: file.name ? file.name.replace('.grid', '') : 'Untitled',
      version: validFile.version,
      contents: JSON.stringify(validFile),
    };
    submit(data, { method: 'POST', action: ROUTES.CREATE_FILE, encType: 'application/json' });
  };

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: Event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return;
    }
    setOpen(false);
  };

  return (
    <>
      <ButtonGroup disableElevation variant="contained" ref={anchorRef} aria-label="split button">
        <Button component={Link} to={ROUTES.CREATE_FILE} disabled={isDisabled}>
          Create file
        </Button>
        <Button
          size="small"
          aria-controls={open ? 'import-file-button-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-label="select merge strategy"
          aria-haspopup="menu"
          onClick={handleToggle}
          disabled={isDisabled}
        >
          <ArrowDropDownIcon fontSize="small" />
        </Button>
      </ButtonGroup>
      <Popper
        sx={{
          zIndex: 1,
        }}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
      >
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom',
            }}
          >
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList id="import-file-button-menu" autoFocusItem>
                  <MenuItem component="label" dense>
                    Import file
                    <input type="file" name="content" accept=".grid" onChange={handleImport} hidden />
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}
