import { ArrowDropDown } from '@mui/icons-material';
import { Box, Divider } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import * as React from 'react';

export function UserRoleMenu({ value }: any) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box>
      <Button
        id="user-role-button"
        aria-controls={open ? 'user-role-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        color="inherit"
        size="small"
        endIcon={<ArrowDropDown fontSize="small" color="inherit" />}
      >
        Can edit
      </Button>
      <Menu
        id="user-role-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'user-role-button',
          dense: true,
        }}
      >
        <MenuItem onClick={handleClose}>Owner</MenuItem>
        <MenuItem onClick={handleClose}>Can edit</MenuItem>
        <MenuItem onClick={handleClose}>Can view</MenuItem>
        <Divider />
        <MenuItem onClick={handleClose}>Resend</MenuItem>
        <MenuItem onClick={handleClose}>Remove</MenuItem>
      </Menu>
    </Box>
  );
}
