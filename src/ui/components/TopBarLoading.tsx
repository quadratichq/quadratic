import { Box } from '@mui/material';

export const TopBarLoading = () => {
  // TopBarLoading allows window to be moved while loading in electron
  return (
    <Box
      style={{
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        //@ts-expect-error
        WebkitAppRegion: 'drag', // this allows the window to be dragged in Electron
        width: '100%',
        display: 'flex',
        height: '40px',
      }}
    ></Box>
  );
};
