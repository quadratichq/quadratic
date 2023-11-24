import { KeyboardArrowDown } from '@mui/icons-material';
import { ButtonBase, Stack, Tooltip, useTheme } from '@mui/material';
import React, { forwardRef } from 'react';

type Props = {
  children: React.ReactNode;
  title: string;
  open?: boolean;
  style?: Object;
};

export const TopBarMenuItem = forwardRef((props: Props, ref) => {
  const { children, title, style, open, ...rest } = props;
  const theme = useTheme();
  const activeStyle = {
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.action.hover,
  };
  const activeIconStyle = { transform: 'translateY(1px)' };
  return (
    <Tooltip ref={ref} arrow disableInteractive enterDelay={500} enterNextDelay={500} title={title} {...rest}>
      <ButtonBase
        disableRipple
        sx={{
          ...(style ? style : {}),
          p: theme.spacing(1),
          color: theme.palette.text.secondary,
          ...(open ? { ...activeStyle, '& .top-bar-dropdown-icon': activeIconStyle } : {}),
          '&:hover': activeStyle,
          '&:hover .top-bar-dropdown-icon': activeIconStyle,
        }}
      >
        <Stack direction="row" alignItems="center">
          {children}
          <KeyboardArrowDown
            className="top-bar-dropdown-icon"
            color="inherit"
            sx={{ fontSize: '1rem', transition: '.2s ease transform' }}
          />
        </Stack>
      </ButtonBase>
    </Tooltip>
  );
});
