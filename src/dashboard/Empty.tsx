import { Box, SvgIcon, Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';

export default function Empty({
  title,
  description,
  actions,
  Icon,
  severity,
}: {
  title: String;
  description: ReactNode;
  actions?: ReactNode;
  Icon: typeof SvgIcon;
  severity?: 'error';
}) {
  const theme = useTheme();

  return (
    <Box sx={{ maxWidth: '30rem', my: theme.spacing(5), mx: 'auto', textAlign: 'center' }}>
      <Box
        sx={{
          mx: 'auto',
          border: `1px solid ${theme.palette.divider}`,
          mb: theme.spacing(3),
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.palette.text.secondary,
        }}
      >
        <Icon fontSize="large" color={severity === 'error' ? 'error' : 'inherit'} />
      </Box>
      <Typography variant="h6" sx={{ mb: theme.spacing(0.5) }} color={severity === 'error' ? 'error' : 'text.primary'}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      {actions && <Box sx={{ mt: theme.spacing(3) }}>{actions}</Box>}
    </Box>
  );
}
