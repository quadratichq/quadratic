import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { QuadraticSnackBar } from '@/app/ui/components/QuadraticSnackBar';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export default function PresentationModeHint() {
  const presentationMode = useRecoilValue(presentationModeAtom);
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
