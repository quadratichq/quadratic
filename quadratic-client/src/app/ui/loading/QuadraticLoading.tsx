import { ThemeAppearanceModeEffects } from '@/shared/hooks/useThemeAppearanceMode';
import { Box, LinearProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import './styles.css';

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
      <div
        style={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <div className="loadingContainer">
          <img className="loadingLogoGif" src="/images/logo_loading.gif" alt="Loading Quadratic Grid"></img>
          <Box sx={{ width: '100px', marginTop: '15px' }}>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        </div>
      </div>
    </>
  );
}
