import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { useEffect, useState } from 'react';
import { TopBarLoading } from '../components/TopBarLoading';

import './styles.css';

export function QuadraticLoading() {
  const [progress, setProgress] = useState<number>(0);

  const loadingMS = 3000;

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) {
          return 100;
        }
        return oldProgress + 1;
      });
    }, loadingMS / 100);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      {/* ToBarLoading allows window to be moved while loading in electron */}
      <TopBarLoading></TopBarLoading>
      <div
        style={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <div className="loadingContainer">
          <img className="loadingLogoGif" src="./images/logo_loading.gif" alt="Loading Quadratic Grid"></img>
          <Box sx={{ width: '100px', marginTop: '15px' }}>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        </div>
      </div>
    </>
  );
}
