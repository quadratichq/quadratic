import { ChatBubbleOutline, Commit } from '@mui/icons-material';
import { Stack, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { isMobileOnly } from 'react-device-detect';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { debugShowCacheCount, debugShowCacheFlag, debugShowFPS } from '../../../debugFlags';
import { SheetController } from '../../../grid/controller/SheetController';
import { focusGrid } from '../../../helpers/focusGrid';
import { JsRenderCell } from '../../../quadratic-core/types';
import { colors } from '../../../theme/colors';
import { ActiveSelectionStats } from './ActiveSelectionStats';
import BottomBarItem from './BottomBarItem';
import PythonState from './PythonState';
import SyncState from './SyncState';

interface Props {
  sheetController: SheetController;
}

export const BottomBar = (props: Props) => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  // todo
  // const loadedState = useRecoilValue(loadedStateAtom);
  const [selectedCell] = useState<JsRenderCell | undefined>();
  const theme = useTheme();

  const [cursorPositionString, setCursorPositionString] = useState('');
  const [multiCursorPositionString, setMultiCursorPositionString] = useState('');
  useEffect(() => {
    const updateCursor = () => {
      const cursor = props.sheetController.sheet.cursor;
      setCursorPositionString(`(${cursor.cursorPosition.x}, ${cursor.cursorPosition.y})`);
      if (cursor.multiCursor) {
        setMultiCursorPositionString(
          `(${cursor.multiCursor.originPosition.x}, ${cursor.multiCursor.originPosition.y}), (${cursor.multiCursor.terminalPosition.x}, ${cursor.multiCursor.terminalPosition.y})`
        );
      } else {
        setMultiCursorPositionString('');
      }
    };
    window.addEventListener('cursor-position', updateCursor);
    return () => window.removeEventListener('cursor-position', updateCursor);
  }, [selectedCell, props.sheetController.sheet]);

  const handleShowGoToMenu = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showGoToMenu: true,
    });

    // Set focus back to Grid
    focusGrid();
  };

  const showOnDesktop = !isMobileOnly;

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderTop: `1px solid ${colors.mediumGray}`,
        color: colors.darkGray,
        bottom: 0,
        width: '100%',
        backdropFilter: 'blur(1px)',
        display: 'flex',
        justifyContent: 'space-between',
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        userSelect: 'none',
      }}
    >
      <Stack direction="row">
        {showOnDesktop && (
          <>
            <BottomBarItem onClick={handleShowGoToMenu}>Cursor: {cursorPositionString}</BottomBarItem>

            {multiCursorPositionString && <BottomBarItem>Selection: {multiCursorPositionString}</BottomBarItem>}

            {/* {selectedCell?.last_modified && (
              <BottomBarItem>
                You, {formatDistance(Date.parse(selectedCell.last_modified), new Date(), { addSuffix: true })}
              </BottomBarItem>
            )} */}
          </>
        )}
        {(debugShowFPS || true) && (
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
        <ActiveSelectionStats sheet={props.sheetController.sheet}></ActiveSelectionStats>
        <SyncState />

        {showOnDesktop && <PythonState />}
        <BottomBarItem
          icon={<ChatBubbleOutline fontSize="inherit" />}
          onClick={() => {
            setEditorInteractionState((prevState) => ({ ...prevState, showFeedbackMenu: true }));
          }}
        >
          Feedback
        </BottomBarItem>
        <BottomBarItem icon={<Commit fontSize="inherit" />}>
          Quadratic {process.env.REACT_APP_VERSION?.slice(0, 7)} (BETA)
        </BottomBarItem>
      </Stack>
    </div>
  );
};
