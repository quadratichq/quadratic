import { ChatBubbleOutline, Commit } from '@mui/icons-material';
import { Stack, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { provideFeedback } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { debugShowCacheCount, debugShowCacheFlag, debugShowFPS } from '../../../debugFlags';
import { sheets } from '../../../grid/controller/Sheets';
import { focusGrid } from '../../../helpers/focusGrid';
import { colors } from '../../../theme/colors';
import BottomBarItem from './BottomBarItem';
import PythonState from './PythonState';
import SyncState from './SyncState';

export const BottomBar = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const theme = useTheme();
  const { permission } = editorInteractionState;

  const [cursorPositionString, setCursorPositionString] = useState('');
  const [multiCursorPositionString, setMultiCursorPositionString] = useState('');
  const cursor = sheets.sheet.cursor;

  useEffect(() => {
    const updateCursor = () => {
      setCursorPositionString(`(${cursor.cursorPosition.x}, ${cursor.cursorPosition.y})`);
      if (cursor.multiCursor) {
        setMultiCursorPositionString(
          `(${cursor.multiCursor.originPosition.x}, ${cursor.multiCursor.originPosition.y}), (${cursor.multiCursor.terminalPosition.x}, ${cursor.multiCursor.terminalPosition.y})`
        );
      } else {
        setMultiCursorPositionString('');
      }
    };
    updateCursor();
    window.addEventListener('cursor-position', updateCursor);
    return () => window.removeEventListener('cursor-position', updateCursor);
  }, [cursor.cursorPosition.x, cursor.cursorPosition.y, cursor.multiCursor]);

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
        {showOnDesktop && cursor.multiCursor && <BottomBarItem>Selection: {multiCursorPositionString}</BottomBarItem>}

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
                width: '0.7rem',
                height: '0.7rem',
                borderRadius: '50%',
              }}
            >
              &nbsp;
            </div>
          </BottomBarItem>
        )}
        {debugShowFPS && (
          <BottomBarItem>
            <span className="debug-show-FPS">--</span> FPS
          </BottomBarItem>
        )}
        {debugShowCacheFlag && (
          <BottomBarItem>
            <span className="debug-show-cache-on" />
          </BottomBarItem>
        )}
        {debugShowCacheCount && (
          <BottomBarItem>
            <span className="debug-show-cache-count" />
          </BottomBarItem>
        )}
      </Stack>
      <Stack direction="row">
        {/*

          todo: when runFormula works again...

        <ActiveSelectionStats sheetController={props.sheetController}></ActiveSelectionStats> */}
        <SyncState />

        {showOnDesktop && <PythonState />}
        {provideFeedback.isAvailable(permission) && (
          <BottomBarItem
            icon={<ChatBubbleOutline fontSize="inherit" />}
            onClick={() => {
              setEditorInteractionState((prevState) => ({ ...prevState, showFeedbackMenu: true }));
            }}
          >
            {provideFeedback.label}
          </BottomBarItem>
        )}
        <BottomBarItem icon={<Commit fontSize="inherit" />}>
          Quadratic {process.env.REACT_APP_VERSION?.slice(0, 7)} (BETA)
        </BottomBarItem>
      </Stack>
    </div>
  );
};
