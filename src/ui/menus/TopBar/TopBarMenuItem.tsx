import { KeyboardArrowDown } from '@mui/icons-material';
import { ButtonBase, Stack, Tooltip, useTheme } from '@mui/material';

// TODO rename, get types, and wrap in forwardRef
export const TopBarMenuItem = (props: any) => {
  const { children, title } = props;
  const theme = useTheme();
  return (
    <Tooltip arrow disableInteractive enterDelay={500} enterNextDelay={500} title={title}>
      <ButtonBase
        disableRipple
        sx={{
          p: theme.spacing(1),
          color: theme.palette.text.secondary,
          '&:hover': {
            color: theme.palette.text.primary,
            // backgroundColor: theme.palette.action.hover,
          },
        }}
      >
        <Stack direction="row" alignItems="center">
          {children}
          <KeyboardArrowDown color="inherit" sx={{ fontSize: '1rem' }} />
        </Stack>
      </ButtonBase>
    </Tooltip>
  );
};
