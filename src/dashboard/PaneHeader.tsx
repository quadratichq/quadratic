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
        background: 'rgba(255,255,255,.90)',
        backdropFilter: 'blur(2px)',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="h5" sx={{ py: theme.spacing(2) }}>
        {title}
      </Typography>
      {actions && <div>{actions}</div>}
    </header>
  );
}
