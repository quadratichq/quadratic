import { PythonState, pythonStateAtom } from '@/atoms/pythonStateAtom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shadcn/ui/dropdown-menu';
import { pythonWebWorker } from '@/web-workers/pythonWebWorker/pythonWebWorker';
import { Check, ErrorOutline, Refresh, Stop } from '@mui/icons-material';
import { CircularProgress, useTheme } from '@mui/material';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';
import BottomBarItem from './BottomBarItem';

const uiLabelByPythonState: Record<PythonState['pythonState'], string> = {
  error: 'error loading',
  ready: 'idle',
  loading: 'loading…',
  running: 'executing…',
};

const PythonStateItem = () => {
  let { pythonState } = useRecoilValue(pythonStateAtom);
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const pythonLabel = 'Python 3.11.3';

  // FYI: we provide an empty onClick because the shadcn DropdownMenu will handle
  // the open/close of the menu itself, so this is a compatibility thing. Eventually
  // We'll make all BottomBarItems use shadcn throughout.

  let pythonStateButton =
    pythonState === 'error' ? (
      <BottomBarItem
        onClick={() => {}}
        icon={<ErrorOutline fontSize="inherit" />}
        style={{
          color: theme.palette.error.main,
          ...(open ? { backgroundColor: theme.palette.error.main, color: 'white' } : {}),
        }}
      >
        {pythonLabel}
      </BottomBarItem>
    ) : pythonState === 'ready' ? (
      <BottomBarItem
        onClick={() => {}}
        icon={<Check fontSize="inherit" />}
        style={open ? { backgroundColor: theme.palette.action.hover } : {}}
      >
        {pythonLabel}
      </BottomBarItem>
    ) : pythonState === 'loading' ? (
      <BottomBarItem
        onClick={() => {}}
        icon={<CircularProgress size="0.5rem" color={open ? 'inherit' : 'warning'} />}
        style={open ? { backgroundColor: theme.palette.warning.dark, color: 'white' } : {}}
      >
        {pythonLabel}
      </BottomBarItem>
    ) : pythonState === 'running' ? (
      <BottomBarItem
        onClick={() => {}}
        icon={<CircularProgress size="0.5rem" color={open ? 'inherit' : 'primary'} />}
        style={open ? { backgroundColor: theme.palette.primary.dark, color: 'white' } : {}}
      >
        {pythonLabel}
      </BottomBarItem>
    ) : (
      <></> // This handles the 'initial' state which really never shows in the UI
    );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{pythonStateButton}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className={`flexz zw-full zjustify-between`}>
          <span>Status:</span>{' '}
          <span
            style={{
              color:
                pythonState === 'error'
                  ? theme.palette.error.main
                  : pythonState === 'loading'
                  ? theme.palette.warning.main
                  : pythonState === 'running'
                  ? theme.palette.primary.main
                  : theme.palette.text.primary,
            }}
          >
            {uiLabelByPythonState[pythonState]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pythonState !== 'running'}
          onClick={() => {
            pythonWebWorker.restartFromUser();
          }}
        >
          <Stop className="mr-2" sx={{ color: theme.palette.text.secondary }} /> Cancel execution
        </DropdownMenuItem>
        {pythonState === 'error' && (
          <DropdownMenuItem
            onClick={() => {
              window.location.reload();
            }}
          >
            <Refresh className="mr-2" sx={{ color: theme.palette.text.secondary }} /> Reload app
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PythonStateItem;
