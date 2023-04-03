import React from 'react';
import { Theme } from '@mui/material';
import { styled } from '@mui/material/styles';

const LayoutColLeftWrapper = styled('div')(({ theme }) => ({
  overflowY: 'scroll',
  padding: theme.spacing(6, 2, 0),
}));

const LayoutColRightWrapper = styled(LayoutColLeftWrapper)(({ theme }) => ({
  background: theme.palette.grey['50'],

  [theme.breakpoints.down('md')]: {
    background: 'transparent',
  },
}));

const col: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  maxWidth: '36rem',
  margin: `0 auto`,
};

const LayoutColLeft = styled('div')(({ theme }) => ({
  ...col,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',

  [theme.breakpoints.down('md')]: {
    marginBottom: theme.spacing(4),
  },
}));

const LayoutColRight = styled('div')(({ theme }) => ({
  ...col,

  [theme.breakpoints.down('md')]: {
    marginBottom: theme.spacing(4),
  },
}));

const LayoutContainer = styled('div')(({ theme }) => ({
  outline: 'none',
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

  [theme.breakpoints.down('md')]: {
    display: 'block',
  },
}));

export { LayoutColLeft, LayoutColRight, LayoutContainer, LayoutColLeftWrapper, LayoutColRightWrapper };

export function getStyles(theme: Theme): { [key: string]: React.CSSProperties } {
  return {
    logo: {
      position: 'fixed',
      background: '#fff',
      padding: theme.spacing(1),
      left: theme.spacing(1),
      top: theme.spacing(1.25),
      zIndex: '2',
      borderRadius: '50%',
    },
    closeBtn: {
      position: 'fixed',
      background: theme.palette.grey['50'],
      right: theme.spacing(1),
      top: theme.spacing(1),
      zIndex: '2',
      borderRadius: '50%',
    },
    colWrapper: {
      overflowY: 'scroll',
      padding: theme.spacing(6, 2, 0),
    },
    iconBtns: { display: 'flex', alignItems: 'ceter', gap: '8px' },
  };
}
