import { Check, ErrorOutline } from '@mui/icons-material';
import { CircularProgress, Tooltip, useTheme } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { loadedStateAtom } from '../../../atoms/loadedStateAtom';
import BottomBarItem from './BottomBarItem';

const PythonState = () => {
  const { pythonLoadState } = useRecoilValue(loadedStateAtom);
  const theme = useTheme();
  const pythonLabel = 'Python 3.9.5';

  if (pythonLoadState === 'error') {
    return (
      <BottomBarItem icon={<ErrorOutline fontSize="inherit" />} style={{ color: theme.palette.error.main }}>
        <Tooltip title="Error loading Python. Please refresh your browser.">
          <span>{pythonLabel}</span>
        </Tooltip>
      </BottomBarItem>
    );
  }

  if (pythonLoadState === 'loaded') {
    return <BottomBarItem icon={<Check fontSize="inherit" />}>{pythonLabel}</BottomBarItem>;
  }

  if (pythonLoadState === 'loading') {
    return <BottomBarItem icon={<CircularProgress size="0.5rem" />}>{pythonLabel}</BottomBarItem>;
  }

  // initial or skipped
  return null;
};

export default PythonState;
