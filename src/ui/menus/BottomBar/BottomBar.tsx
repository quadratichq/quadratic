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

  const cursor = props.sheetController.sheet.cursor;
  // Generate string describing cursor location
  const cursorPositionString = `(${cursor.cursorPosition.x}, ${cursor.cursorPosition.y})`;
  const multiCursorPositionString = cursor.multiCursor
    ? `(${cursor.multiCursor.originPosition.x}, ${cursor.multiCursor.originPosition.y}), (${cursor.multiCursor.terminalPosition.x}, ${cursor.multiCursor.terminalPosition.y})`
    : '';

  // todo
  useEffect(() => {
    // const updateCellData = async () => {
    //   // Don't update if we have not moved cursor position
    //   if (Number(selectedCell?.x) === cursor.cursorPosition.x && Number(selectedCell?.y) === cursor.cursorPosition.y)
    //     return;
    //   console.log(cursor.cursorPosition, selectedCell);
    //   // Get cell at position
    //   const cell = props.sheetController.sheet.getRenderCell(cursor.cursorPosition.x, cursor.cursorPosition.y);
    //   // If cell exists set selectedCell
    //   // Otherwise set to undefined
    //   if (cell) {
    //     setSelectedCell(cell);
    //   } else {
    //     setSelectedCell(undefined);
    //   }
    // };
    // updateCellData();
  }, [selectedCell, cursor.cursorPosition.x, cursor.cursorPosition.y, props.sheetController.sheet]);

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

            {cursor.multiCursor && <BottomBarItem>Selection: {multiCursorPositionString}</BottomBarItem>}
            {/*
              // todo
            {selectedCell?.last_modified && (
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
