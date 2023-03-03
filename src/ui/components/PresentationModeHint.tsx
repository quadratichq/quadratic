import { useState, useEffect } from 'react';
import { useGridSettings } from '../menus/TopBar/SubMenus/useGridSettings';
import { KeyboardSymbols } from '../../helpers/keyboardSymbols';
import { QuadraticSnackBar } from './QuadraticSnackBar';

export default function PresentationModeHint() {
  const { presentationMode } = useGridSettings();
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    if (presentationMode) {
      setOpen(true);
    }
  }, [presentationMode]);

  return (
    <QuadraticSnackBar
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      message={`Press “${KeyboardSymbols.Command}.” to exit presentation mode.`}
    />
  );
}
