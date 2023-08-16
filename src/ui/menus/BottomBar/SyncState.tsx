import { ErrorOutline } from '@mui/icons-material';
import { CircularProgress, Tooltip, useTheme } from '@mui/material';
import { ShowAfter } from '../../../components/ShowAfter';
import { useFileContext } from '../../contexts/FileContext';
import BottomBarItem from './BottomBarItem';

export default function SyncState() {
  const theme = useTheme();
  const { syncState } = useFileContext();

  if (syncState === 'idle') {
    return null;
  }

  return (
    <>
      <ShowAfter delay={300}>
        <>
          {syncState === 'error' && (
            <Tooltip title="Your recent changes haven’t been saved. Make sure you’re connected to the internet.">
              <BottomBarItem
                icon={<ErrorOutline color="inherit" fontSize="inherit" />}
                style={{ color: theme.palette.error.main }}
              >
                Syncing error
              </BottomBarItem>
            </Tooltip>
          )}
          {syncState === 'syncing' && <BottomBarItem icon={<CircularProgress size="0.5rem" />}>Syncing…</BottomBarItem>}
        </>
      </ShowAfter>
    </>
  );
}
