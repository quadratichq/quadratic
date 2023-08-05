import { ErrorOutline } from '@mui/icons-material';
import { CircularProgress, useTheme } from '@mui/material';
import ShowAfter from 'shared/ShowAfter';
import { useFile } from 'ui/contexts/File';

export default function SyncState() {
  const theme = useTheme();
  const { syncState } = useFile();

  if (syncState === 'idle') {
    return null;
  }

  return (
    <ShowAfter delay={300}>
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
    </ShowAfter>
  );
}
