import { ButtonBase, Tooltip, useTheme } from '@mui/material';
import type { ButtonBaseProps } from '@mui/material';

interface Props extends ButtonBaseProps {
  buttonRef?: any;
  tooltip?: string;
}

export const SheetBarButton = ({ children, buttonRef, tooltip, ...rest }: Props) => {
  const theme = useTheme();

  const buttonStyles = {
    px: theme.spacing(1.5),
    '&:hover': {
      background: theme.palette.action.hover,

      '& svg': {
        fill: theme.palette.text.primary,
      },
    },
  };

  const buttonProps = {
    ...rest,
    ...(buttonRef ? { ref: buttonRef } : {}),
  };

  return (
    <Tooltip title={tooltip ?? ''}>
      <ButtonBase sx={buttonStyles} {...buttonProps}>
        {children}
      </ButtonBase>
    </Tooltip>
  );
};
