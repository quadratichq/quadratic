import { ChatBubbleOutline, Check, ErrorOutline } from '@mui/icons-material';
import { CircularProgress, Tooltip } from '@mui/material';
import { Box } from '@mui/system';
import { formatDistance } from 'date-fns';
import { useEffect, useState } from 'react';
import { isMobileOnly } from 'react-device-detect';
import { useRecoilState, useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { loadedStateAtom } from '../../../atoms/loadedStateAtom';
import { debugShowCacheCount, debugShowCacheFlag, debugShowFPS, debugShowRenderer } from '../../../debugFlags';
import { Sheet } from '../../../grid/sheet/Sheet';
import { focusGrid } from '../../../helpers/focusGrid';
import { Cell } from '../../../schemas';
import { colors } from '../../../theme/colors';
import { ActiveSelectionStats } from './ActiveSelectionStats';
import SyncState from './SyncState';

const stylesAlignCenter = { display: 'flex', alignItems: 'center', gap: '.25rem' };

interface Props {
  sheet: Sheet;
}

export const BottomBar = (props: Props) => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const loadedState = useRecoilValue(loadedStateAtom);
  const [selectedCell, setSelectedCell] = useState<Cell | undefined>();

  const {
    showMultiCursor,
    cursorPosition,
    multiCursorPosition: { originPosition, terminalPosition },
  } = interactionState;

  // Generate string describing cursor location
  const cursorPositionString = `(${cursorPosition.x}, ${cursorPosition.y})`;
  const multiCursorPositionString = `(${originPosition.x}, ${originPosition.y}), (${terminalPosition.x}, ${terminalPosition.y})`;

  useEffect(() => {
    const updateCellData = async () => {
      // Don't update if we have not moved cursor position
      if (
        selectedCell?.x === interactionState.cursorPosition.x &&
        selectedCell?.y === interactionState.cursorPosition.y
      )
        return;

      // Get cell at position
      const cell = props.sheet.getCellCopy(interactionState.cursorPosition.x, interactionState.cursorPosition.y);

      // If cell exists set selectedCell
      // Otherwise set to undefined
      if (cell) {
        setSelectedCell(cell);
      } else {
        setSelectedCell(undefined);
      }
    };
    updateCellData();
  }, [interactionState, selectedCell, props.sheet]);

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
        {showMultiCursor && (
          <span style={{ cursor: 'pointer' }} onClick={handleShowGoToMenu}>
            Selection: {multiCursorPositionString}
          </span>
        )}
        {selectedCell?.last_modified && (
          <span>You, {formatDistance(Date.parse(selectedCell.last_modified), new Date(), { addSuffix: true })}</span>
        )}
        {debugShowRenderer && (
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
        <ActiveSelectionStats interactionState={interactionState}></ActiveSelectionStats>
        <SyncState />

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
