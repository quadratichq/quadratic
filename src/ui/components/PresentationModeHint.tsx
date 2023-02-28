import { useState, useEffect } from 'react';
import { Snackbar } from '@mui/material';
import { useGridSettings } from '../menus/TopBar/SubMenus/useGridSettings';
import { KeyboardSymbols } from '../../helpers/keyboardSymbols';

export default function PresentationModeHint() {
  const { presentationMode } = useGridSettings();
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    if (presentationMode) {
      setOpen(true);
    }
  }, [presentationMode]);

  return (
    <Snackbar
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      autoHideDuration={5000}
      message={`Press “${KeyboardSymbols.Command}.” to exit presentation mode.`}
    />
  );
}
