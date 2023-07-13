import { Box } from '@mui/system';
import { colors } from '../../../theme/colors';
import { useRecoilState } from 'recoil';
import { useEffect, useState } from 'react';
import { Cell } from '../../../schemas';
import { formatDistance } from 'date-fns';
import { focusGrid } from '../../../helpers/focusGrid';
import { isMobileOnly } from 'react-device-detect';
import { debugShowCacheFlag, debugShowFPS, debugShowRenderer, debugShowCacheCount } from '../../../debugFlags';
import { Sheet } from '../../../grid/sheet/Sheet';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { ChatBubbleOutline } from '@mui/icons-material';

interface Props {
  sheet: Sheet;
}

export const BottomBar = (props: Props) => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [selectedCell, setSelectedCell] = useState<Cell | undefined>();

  const cursor = props.sheet.cursor;
  // Generate string describing cursor location
  const cursorPositionString = `(${cursor.cursorPosition.x}, ${cursor.cursorPosition.y})`;
  const multiCursorPositionString = cursor.multiCursor
    ? `(${cursor.multiCursor.originPosition.x}, ${cursor.multiCursor.originPosition.y}), (${cursor.multiCursor.terminalPosition.x}, ${cursor.multiCursor.terminalPosition.y})`
    : '';

  useEffect(() => {
    const updateCellData = async () => {
      // Don't update if we have not moved cursor position
      if (selectedCell?.x === cursor.cursorPosition.x && selectedCell?.y === cursor.cursorPosition.y) return;

      // Get cell at position
      const cell = props.sheet.getCellCopy(cursor.cursorPosition.x, cursor.cursorPosition.y);

      // If cell exists set selectedCell
      // Otherwise set to undefined
      if (cell) {
        setSelectedCell(cell);
      } else {
        setSelectedCell(undefined);
      }
    };
    updateCellData();
  }, [selectedCell, props.sheet, cursor.cursorPosition.x, cursor.cursorPosition.y]);

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
        {!isMobileOnly && (
          <>
            <span
              style={{ display: 'flex', alignItems: 'center', gap: '.25rem', cursor: 'pointer' }}
              onClick={() => {
                setEditorInteractionState((prevState) => ({ ...prevState, showFeedbackMenu: true }));
              }}
            >
              <ChatBubbleOutline fontSize="inherit" />
              Feedback
            </span>
            <span>✓ Python 3.9.5</span>
          </>
        )}
        <span>✓ Quadratic {process.env.REACT_APP_VERSION}</span>
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
