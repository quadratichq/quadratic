import { events } from '@/app/events/events';
import { FeedbackIcon } from '@/app/ui/icons';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderData } from '@/routes/file.$uuid';
import { Commit } from '@mui/icons-material';
import { Stack, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { provideFeedbackAction } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { debugShowFPS } from '../../../debugFlags';
import { sheets } from '../../../grid/controller/Sheets';
import { focusGrid } from '../../../helpers/focusGrid';
import { colors } from '../../../theme/colors';
import BottomBarItem from './BottomBarItem';
import { KernelMenu } from './KernelMenu';
import { SelectionSummary } from './SelectionSummary';
import SyncState from './SyncState';

export const BottomBar = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const theme = useTheme();
  const { permissions } = editorInteractionState;
  const { isAuthenticated } = useRootRouteLoaderData();
  const [cursorPositionString, setCursorPositionString] = useState('');
  const [multiCursorPositionString, setMultiCursorPositionString] = useState('');
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions },
  } = useFileRouteLoaderData();

  const isAvailableArgs = { filePermissions: permissions, fileTeamPrivacy, isAuthenticated, teamPermissions };

  useEffect(() => {
    const updateCursor = () => {
      const cursor = sheets.sheet.cursor;
      setCursorPositionString(`(${cursor.cursorPosition.x}, ${cursor.cursorPosition.y})`);
      if (cursor.multiCursor && cursor.multiCursor.length === 1) {
        const multiCursor = cursor.multiCursor[0];
        setMultiCursorPositionString(
          `(${multiCursor.left}, ${multiCursor.top}), (${multiCursor.right - 1}, ${multiCursor.bottom - 1})`
        );
      } else {
        setMultiCursorPositionString('');
      }
    };
    updateCursor();
    events.on('cursorPosition', updateCursor);
    events.on('changeSheet', updateCursor);
    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('changeSheet', updateCursor);
    };
  }, []);

  const handleShowGoToMenu = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showGoToMenu: true,
    });

    // Set focus back to Grid
    focusGrid();
  };

  const showOnDesktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderTop: `1px solid ${theme.palette.divider}`,
        color: colors.darkGray,
        bottom: 0,
        width: '100%',
        backdropFilter: 'blur(1px)',
        display: 'flex',
        justifyContent: 'space-between',
        userSelect: 'none',
      }}
    >
      <Stack direction="row">
        {showOnDesktop && <BottomBarItem onClick={handleShowGoToMenu}>Cursor: {cursorPositionString}</BottomBarItem>}
        {showOnDesktop && sheets.sheet.cursor.multiCursor && (
          <BottomBarItem>Selection: {multiCursorPositionString}</BottomBarItem>
        )}

        {/* {showOnDesktop && selectedCell?.last_modified && (
          <BottomBarItem>
            You, {formatDistance(Date.parse(selectedCell.last_modified), new Date(), { addSuffix: true })}
          </BottomBarItem>
        )} */}

        {debugShowFPS && (
          <BottomBarItem>
            <div
              className="debug-show-renderer"
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                marginRight: 3,
              }}
            >
              &nbsp;
            </div>
            <span className="debug-show-FPS">--</span> FPS
          </BottomBarItem>
        )}
      </Stack>
      <Stack direction="row">
        <SelectionSummary />
        <SyncState />
        <KernelMenu />
        {/* {showOnDesktop && <PythonStateItem />} */}
        {provideFeedbackAction.isAvailable(isAvailableArgs) && (
          <BottomBarItem
            icon={<FeedbackIcon fontSize="inherit" />}
            onClick={() => {
              setEditorInteractionState((prevState) => ({ ...prevState, showFeedbackMenu: true }));
            }}
          >
            {provideFeedbackAction.label}
          </BottomBarItem>
        )}
        {showOnDesktop && (
          <BottomBarItem icon={<Commit fontSize="inherit" />}>
            Quadratic {import.meta.env.VITE_VERSION?.slice(0, 7)} (BETA)
          </BottomBarItem>
        )}
      </Stack>
    </div>
  );
};
