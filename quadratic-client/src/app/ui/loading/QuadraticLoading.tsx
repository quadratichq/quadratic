import { RootLoadingIndicator } from '@/shared/components/RootLoadingIndicator';
import { ThemeAppearanceModeEffects } from '@/shared/hooks/useThemeAppearanceMode';
import { LinearProgress } from '@mui/material';
import { useEffect, useState } from 'react';

export function QuadraticLoading() {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) {
          return 100;
        }
        return oldProgress + 2;
      });
    }, 10);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      {/* ToBarLoading allows window to be moved while loading in electron */}
      <ThemeAppearanceModeEffects />

      <RootLoadingIndicator>
        <LinearProgress variant="determinate" value={progress} />
      </RootLoadingIndicator>
    </>
  );
}
