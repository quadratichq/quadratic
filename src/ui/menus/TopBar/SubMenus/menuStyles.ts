import { CSSProperties } from 'react';
import { colors } from '../../../../theme/colors';

export const topBarIconStyles = {
  width: '0.85em',
  height: '0.85em',
} as CSSProperties;

export const menuItemIconStyles = {
  marginRight: '0.5rem',
  color: colors.darkGray,
};

export const menuItemIconDisabledStyles = {
  ...menuItemIconStyles,
  color: 'inherit',
};
