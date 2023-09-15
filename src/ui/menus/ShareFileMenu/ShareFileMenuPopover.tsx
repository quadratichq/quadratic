import { ArrowDropDown, Check } from '@mui/icons-material';
import { ListItemIcon, ListItemText, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import * as React from 'react';

type Option = {
  label: string;
  value: string;
  disabled?: boolean;
};

export function ShareFileMenuPopover({
  options,
  setValue,
  value,
  disabled,
}: {
  options: Option[];
  setValue: Function;
  value: string;
  disabled?: boolean;
}) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const activeOption = options.find((element) => element.value === value) as Option;

  return (
    <div>
      <Button
        id="demo-positioned-button"
        aria-controls={open ? 'demo-positioned-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleOpen}
        color="inherit"
        disabled={disabled}
        endIcon={disabled ? undefined : <ArrowDropDown />}
      >
        {activeOption.label}
      </Button>
      <Menu
        id="demo-positioned-menu"
        aria-labelledby="demo-positioned-button"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        sx={{ fontSize: '.875rem' }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <MenuItem
              onClick={() => {
                handleClose();
                setValue(option.value);
              }}
              dense
              disabled={option.disabled || disabled}
              key={option.value}
              selected={selected}
            >
              {selected && (
                <ListItemIcon>
                  <Check />
                </ListItemIcon>
              )}
              <ListItemText inset={!selected} disableTypography>
                <Typography variant="body2">{option.label}</Typography>
              </ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </div>
  );
}
