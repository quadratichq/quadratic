import { events } from '@/events/events';
import { multiplayer } from '@/web-workers/multiplayerWebWorker/multiplayer';
import { MultiplayerState } from '@/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { Check, ErrorOutline } from '@mui/icons-material';
import { CircularProgress, Tooltip, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import BottomBarItem from './BottomBarItem';

export default function SyncState() {
  const theme = useTheme();

  const [syncState, setSyncState] = useState<MultiplayerState>(multiplayer.state);

  useEffect(() => {
    const updateState = (state: MultiplayerState) => setSyncState(state);
    events.on('multiplayerState', updateState);
    return () => {
      events.off('multiplayerState', updateState);
    };
  }, []);

  let tooltip: string;
  let icon: JSX.Element;
  let message: string | JSX.Element;

  if (['waiting to reconnect', 'connecting'].includes(syncState) && multiplayer.brokenConnection) {
    icon = <CircularProgress size="0.5rem" />;
    message = <span style={{ color: theme.palette.error.main }}>Reconnecting…</span>;
    tooltip =
      'Attempting to connect to the Quadratic server after losing connection. Your changes may only be saved locally…';
  } else if (['not connected', 'connecting', 'waiting to reconnect', 'startup'].includes(syncState)) {
    icon = <CircularProgress size="0.5rem" />;
    message = <span>Connecting…</span>;
    tooltip = 'Connecting to the Quadratic server…';
  } else if (syncState === 'syncing') {
    icon = <CircularProgress size="0.5rem" />;
    message = <span>Connected</span>;
    tooltip = 'Syncing changes to the Quadratic server. Your recent changes are saved locally.';
  } else if (syncState === 'connected') {
    icon = <Check fontSize="inherit" />;
    message = <span>Connected</span>;
    tooltip = 'Connected to the Quadratic server. Your changes are saved.';
  } else if (syncState === 'no internet') {
    icon = <ErrorOutline fontSize="inherit" style={{ color: theme.palette.error.main }} />;
    message = <span style={{ color: theme.palette.error.main }}>Offline</span>;
    tooltip = 'Your internet connection appears not to be working. Your changes are only saved locally.';
  } else {
    icon = <ErrorOutline fontSize="inherit" style={{ color: theme.palette.error.main }} />;
    tooltip =
      "Connection to the Quadratic server was lost. We'll continue trying to reconnect. Your changes are only saved locally.";
    message = <span style={{ color: theme.palette.error.main }}>Offline</span>;
  }

  return (
    <BottomBarItem icon={icon}>
      <Tooltip title={tooltip}>{message}</Tooltip>
    </BottomBarItem>
  );
}
