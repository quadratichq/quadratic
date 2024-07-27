import { useState, useEffect } from 'react';

import { QuadraticSnackBar } from '@/app/ui/components/QuadraticSnackBar';
import { useGridSettings } from '@/app/ui/menus/TopBar/SubMenus/useGridSettings';

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
      autoHideDuration={4000}
      message={`Press "ESC" to exit presentation mode.`}
    />
  );
}
