import { pythonWebWorker } from '@/web-workers/pythonWebWorker/python';
import { Check, ErrorOutline } from '@mui/icons-material';
import { CircularProgress, Tooltip, useTheme } from '@mui/material';
import { Menu, MenuHeader, MenuItem } from '@szhsin/react-menu';
import { useRecoilValue } from 'recoil';
import { pythonStateAtom } from '../../../atoms/pythonStateAtom';
import BottomBarItem from './BottomBarItem';

const PythonStateItem = () => {
  const { pythonState } = useRecoilValue(pythonStateAtom);

  const theme = useTheme();
  const pythonLabel = 'Python 3.9.5';

  let pythonStateLabel = <></>;

  if (pythonState === 'error') {
    pythonStateLabel = (
      <BottomBarItem icon={<ErrorOutline fontSize="inherit" />} style={{ color: theme.palette.error.main }}>
        <Tooltip title="Error loading Python. Please refresh your browser.">
          <span>{pythonLabel}</span>
        </Tooltip>
      </BottomBarItem>
    );
  }

  if (pythonState === 'idle') {
    pythonStateLabel = <BottomBarItem icon={<Check fontSize="inherit" />}>{pythonLabel}</BottomBarItem>;
  }

  if (pythonState === 'loading') {
    pythonStateLabel = (
      <BottomBarItem icon={<CircularProgress size="0.5rem" color="success" />}>{pythonLabel}</BottomBarItem>
    );
  }

  if (pythonState === 'running') {
    pythonStateLabel = (
      <BottomBarItem icon={<CircularProgress size="0.5rem" color="primary" />}>{pythonLabel}</BottomBarItem>
    );
  }

  return (
    <>
      <Menu menuButton={pythonStateLabel}>
        <MenuHeader>Python status: {pythonState}</MenuHeader>
        <MenuItem
          disabled={pythonState !== 'running'}
          onClick={() => {
            pythonWebWorker.restartFromUser();
          }}
        >
          Stop python
        </MenuItem>
      </Menu>
    </>
  );
};

export default PythonStateItem;
