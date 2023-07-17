import { Box, Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';

export default function Empty({
  title,
  description,
  actions,
  Icon,
}: {
  title: String;
  description: String;
  actions?: ReactNode;
  Icon: any;
}) {
  const theme = useTheme();

  return (
    <Box sx={{ maxWidth: '30rem', my: theme.spacing(5), mx: 'auto', textAlign: 'center' }}>
      <Box sx={{ mb: theme.spacing(2), color: theme.palette.text.secondary }}>
        <Icon fontSize="large" color="inherit" />
      </Box>
      <Typography variant="subtitle1" sx={{ mb: theme.spacing(1) }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      {actions && <Box sx={{ mt: theme.spacing(2) }}>{actions}</Box>}
    </Box>
  );
}
