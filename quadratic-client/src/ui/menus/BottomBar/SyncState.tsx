import { MultiplayerState, multiplayer } from '@/multiplayer/multiplayer';
import { Check, ErrorOutline } from '@mui/icons-material';
import { CircularProgress, Tooltip, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import BottomBarItem from './BottomBarItem';

export default function SyncState() {
  const theme = useTheme();

  const [syncState, setSyncState] = useState<MultiplayerState>(multiplayer.state);

  useEffect(() => {
    const updateState = (e: any) => setSyncState(e.detail);
    window.addEventListener('multiplayer-state', updateState);
    return () => window.removeEventListener('multiplayer-state', updateState);
  }, []);

  if (['connecting', 'startup'].includes(syncState)) {
    return <BottomBarItem icon={<CircularProgress size="0.5rem" />}>Connecting…</BottomBarItem>;
  }

  if (syncState === 'syncing') {
    return <BottomBarItem icon={<CircularProgress size="0.5rem" />}>Connected to Server</BottomBarItem>;
  }

  if (syncState === 'connected') {
    return <BottomBarItem icon={<Check fontSize="inherit" />}>Connected to Server</BottomBarItem>;
  }

  // else error
  return (
    <BottomBarItem icon={<ErrorOutline fontSize="inherit" style={{ color: theme.palette.error.main }} />}>
      <Tooltip title="Connection to the Quadratic server was lost. Your changes are only saving locally.">
        <span style={{ color: theme.palette.error.main }}>Offline mode</span>
      </Tooltip>
    </BottomBarItem>
  );
}
