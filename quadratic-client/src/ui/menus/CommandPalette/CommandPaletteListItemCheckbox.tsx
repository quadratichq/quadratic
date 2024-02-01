import { Checkbox } from '@mui/material';

export const CommandPaletteListItemCheckbox = ({ checked }: { checked: boolean }) => (
  <Checkbox sx={{ p: 0 }} checked={checked} tabIndex={-1} disableRipple />
);
