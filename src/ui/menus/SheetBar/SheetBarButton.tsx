import { ButtonBase, ButtonBaseProps, useTheme } from '@mui/material';

interface Props extends ButtonBaseProps {
  buttonRef?: any;
}

export const SheetBarButton = ({ children, buttonRef, ...rest }: Props) => {
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
    <ButtonBase sx={buttonStyles} {...buttonProps}>
      {children}
    </ButtonBase>
  );
};
