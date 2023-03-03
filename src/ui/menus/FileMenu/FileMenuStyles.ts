import React from 'react';
import { Theme } from '@mui/material';

export function getStyles(theme: Theme): { [key: string]: React.CSSProperties } {
  return {
    container: {
      position: 'fixed',
      width: '100%',
      height: '100%',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      background: '#fff',
      zIndex: '100',
      display: 'grid',
      gridTemplateColumns: '50% 50%',
      overflow: 'scroll',
    },
    logo: {
      position: 'fixed',
      left: theme.spacing(2),
      top: theme.spacing(2),
    },
    closeBtn: {
      position: 'fixed',
      right: theme.spacing(1),
      top: theme.spacing(1),
    },
    cols: {
      maxWidth: '36rem',
      margin: `${theme.spacing(6)} auto`,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    },
    iconBtns: { display: 'flex', alignItems: 'ceter', gap: '8px' },
  };
}
