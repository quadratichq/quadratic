import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
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
      <img className="loadingLogoGif" src="/images/logo_loading.gif" alt="Loading Quadratic Grid"></img>
      <Box sx={{ width: '100px', marginTop: '15px' }}>
        <LinearProgress variant="determinate" value={progress} />
      </Box>
    </>
  );
}
