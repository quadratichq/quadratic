import { ErrorOutline } from '@mui/icons-material';
import { CircularProgress, useTheme } from '@mui/material';
import { useFile } from 'ui/contexts/File';

export default function SyncState() {
  const theme = useTheme();
  const { syncState } = useFile();

  // TODO only render if the state for this has changed for longer than X milliseconds

  if (syncState === 'idle') {
    return null;
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing(0.5) }}>
      {syncState === 'error' && (
        <>
          <ErrorOutline style={{ color: 'red' }} fontSize="inherit" /> Sync error
        </>
      )}
      {syncState === 'syncing' && (
        <>
          <CircularProgress size="0.5rem" /> Syncing…
        </>
      )}
    </span>
  );
}
