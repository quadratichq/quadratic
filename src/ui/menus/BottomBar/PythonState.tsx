import { Check, ErrorOutline } from '@mui/icons-material';
import { CircularProgress, Tooltip, useTheme } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { pythonStateAtom } from '../../../atoms/pythonStateAtom';
import BottomBarItem from './BottomBarItem';

const PythonState = () => {
  const { pythonState } = useRecoilValue(pythonStateAtom);

  const theme = useTheme();
  const pythonLabel = 'Python 3.9.5';

  if (pythonState === 'error') {
    return (
      <BottomBarItem icon={<ErrorOutline fontSize="inherit" />} style={{ color: theme.palette.error.main }}>
        <Tooltip title="Error loading Python. Please refresh your browser.">
          <span>{pythonLabel}</span>
        </Tooltip>
      </BottomBarItem>
    );
  }

  if (pythonState === 'idle') {
    return <BottomBarItem icon={<Check fontSize="inherit" />}>{pythonLabel}</BottomBarItem>;
  }

  if (pythonState === 'loading') {
    return <BottomBarItem icon={<CircularProgress size="0.5rem" color="primary" />}>{pythonLabel}</BottomBarItem>;
  }

  if (pythonState === 'running') {
    return <BottomBarItem icon={<CircularProgress size="0.5rem" color="error" />}>{pythonLabel}</BottomBarItem>;
  }

  return null;
};

export default PythonState;
