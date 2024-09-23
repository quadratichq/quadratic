import { useEffect, useState } from 'react';
import { useGridSettings } from '../hooks/useGridSettings';
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
      autoHideDuration={4000}
      message={`Press "ESC" to exit presentation mode.`}
    />
  );
}
