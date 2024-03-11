import { KeyboardArrowDown } from '@mui/icons-material';
import { ButtonBase, Stack, Tooltip, useTheme } from '@mui/material';
import React, { forwardRef } from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
  title: string;
  open?: boolean;
  buttonProps?: any;
  noDropdown?: boolean;
};

export const TopBarMenuItem = forwardRef((props: Props, ref) => {
  const { children, title, open, noDropdown, buttonProps, className, ...rest } = props;
  const theme = useTheme();
  const activeStyle = {
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.action.hover,
  };
  const activeIconStyle = { transform: 'translateY(1px)' };
  return (
    <Tooltip ref={ref} arrow disableInteractive enterDelay={500} enterNextDelay={500} title={title} {...rest}>
      <ButtonBase
        {...(buttonProps ? buttonProps : {})}
        className={className}
        disableRipple
        sx={{
          p: theme.spacing(1),
          ...(open ? { ...activeStyle, '& .top-bar-dropdown-icon': activeIconStyle } : {}),
          '&:hover': activeStyle,
          '&:hover .top-bar-dropdown-icon': activeIconStyle,
        }}
      >
        <Stack direction="row" alignItems="center" minWidth="1.5rem" justifyContent="center">
          {children}
          {!noDropdown && (
            <KeyboardArrowDown
              className="top-bar-dropdown-icon"
              color="inherit"
              sx={{ fontSize: '.8125rem', transition: '.2s ease transform' }}
            />
          )}
        </Stack>
      </ButtonBase>
    </Tooltip>
  );
});
