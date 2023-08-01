import { Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';

export default function Header({ title, actions }: { title: string; actions?: ReactNode }) {
  const theme = useTheme();

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: '0',
        background: theme.palette.background.default,
        backdropFilter: 'blur(2px)',
        borderBottom: `1px solid ${theme.palette.divider}`,
        zIndex: '1',
      }}
    >
      <Typography variant="h5" sx={{ py: theme.spacing(2) }} color="text.primary">
        {title}
      </Typography>
      {actions && <div>{actions}</div>}
    </header>
  );
}
