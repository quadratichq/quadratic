/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChatBubbleOutline, Check, ErrorOutline } from '@mui/icons-material';
import { CircularProgress, Tooltip } from '@mui/material';
import { Box } from '@mui/system';
import { useEffect, useState } from 'react';
import { isMobileOnly } from 'react-device-detect';
import { useRecoilState, useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { loadedStateAtom } from '../../../atoms/loadedStateAtom';
import { debugShowCacheCount, debugShowCacheFlag, debugShowFPS } from '../../../debugFlags';
import { SheetController } from '../../../grid/controller/SheetController';
import { focusGrid } from '../../../helpers/focusGrid';
import { JsRenderCell } from '../../../quadratic-core/types';
import { colors } from '../../../theme/colors';
import { ActiveSelectionStats } from './ActiveSelectionStats';

const stylesAlignCenter = { display: 'flex', alignItems: 'center', gap: '.25rem' };

interface Props {
  sheetController: SheetController;
}

export const BottomBar = (props: Props) => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const loadedState = useRecoilValue(loadedStateAtom);
  const [selectedCell, setSelectedCell] = useState<JsRenderCell | undefined>();

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
        height: '1.5rem',
        backdropFilter: 'blur(1px)',
        display: 'flex',
        justifyContent: 'space-between',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        fontFamily: 'sans-serif',
        fontSize: '0.7rem',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <span style={{ cursor: 'pointer' }} onClick={handleShowGoToMenu}>
          Cursor: {cursorPositionString}
        </span>
        {cursor.multiCursor && (
          <span style={{ cursor: 'pointer' }} onClick={handleShowGoToMenu}>
            Selection: {multiCursorPositionString}
          </span>
        )}
        {/* {selectedCell?.last_modified && (
          <span>You, {formatDistance(Date.parse(selectedCell.last_modified), new Date(), { addSuffix: true })}</span>
        )} */}
        {debugShowFPS && (
          <span
            className="debug-show-renderer"
            style={{
              width: '0.7rem',
              height: '0.7rem',
              borderRadius: '50%',
            }}
          >
            &nbsp;
          </span>
        )}
        {debugShowFPS && (
          <span>
            <span className="debug-show-FPS">--</span> FPS
          </span>
        )}
        {debugShowCacheFlag && <span className="debug-show-cache-on" />}
        {debugShowCacheCount && <span className="debug-show-cache-count" />}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <ActiveSelectionStats sheet={props.sheetController.sheet}></ActiveSelectionStats>
        {!isMobileOnly && (
          <>
            <span style={stylesAlignCenter}>
              {loadedState.pythonLoaded === 'error' ? (
                <Tooltip title="Error loading Python. Please refresh your browser.">
                  <ErrorOutline style={{ color: 'red' }} fontSize="inherit" />
                </Tooltip>
              ) : loadedState.pythonLoaded ? (
                <Check fontSize="inherit" />
              ) : (
                <CircularProgress size="0.5rem" />
              )}{' '}
              Python 3.9.5
            </span>
          </>
        )}
        <span style={stylesAlignCenter}>
          <Check fontSize="inherit" /> Quadratic {process.env.REACT_APP_VERSION}
        </span>
        <span
          style={{ ...stylesAlignCenter, cursor: 'pointer' }}
          onClick={() => {
            setEditorInteractionState((prevState) => ({ ...prevState, showFeedbackMenu: true }));
          }}
        >
          <ChatBubbleOutline fontSize="inherit" />
          Feedback
        </span>
        <span
          style={{
            color: '#ffffff',
            backgroundColor: colors.quadraticSecondary,
            padding: '2px 5px 2px 5px',
            borderRadius: '2px',
          }}
        >
          BETA
        </span>
      </Box>
    </div>
  );
};
