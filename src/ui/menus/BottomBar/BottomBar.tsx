import { Box } from '@mui/system';
import { colors } from '../../../theme/colors';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { useEffect, useState } from 'react';
import { Cell } from '../../../core/gridDB/db';
import { GetCellsDB } from '../../../core/gridDB/Cells/GetCellsDB';
import { formatDistance } from 'date-fns';
import { focusGrid } from '../../../helpers/focusGrid';

export const BottomBar = () => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const [selectedCell, setSelectedCell] = useState<Cell | undefined>();

  // Generate string describing cursor location
  const cursorPositionString = `(${interactionState.cursorPosition.x}, ${interactionState.cursorPosition.y})`;
  const multiCursorPositionString = `(${interactionState.multiCursorPosition.originPosition.x}, ${interactionState.multiCursorPosition.originPosition.y}), (${interactionState.multiCursorPosition.terminalPosition.x}, ${interactionState.multiCursorPosition.terminalPosition.y})`;

  useEffect(() => {
    const updateCellData = async () => {
      // Don't update if we have not moved cursor position
      if (
        selectedCell?.x === interactionState.cursorPosition.x &&
        selectedCell?.y === interactionState.cursorPosition.y
      )
        return;

      // Get cell at position
      const cells = await GetCellsDB(
        interactionState.cursorPosition.x,
        interactionState.cursorPosition.y,
        interactionState.cursorPosition.x,
        interactionState.cursorPosition.y
      );

      // If cell exists set selectedCell
      // Otherwise set to undefined
      if (cells.length) {
        setSelectedCell(cells[0]);
      } else {
        setSelectedCell(undefined);
      }
    };
    updateCellData();
  }, [interactionState, selectedCell]);

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
        <span
          style={{ cursor: 'pointer' }}
          onClick={() => {
            // copy cell position
            navigator.clipboard.writeText(cursorPositionString);
            // Set focus back to Grid
            focusGrid();
          }}
        >
          Cursor: {cursorPositionString}
        </span>
        {selectedCell?.last_modified && (
          <span>You, {formatDistance(Date.parse(selectedCell.last_modified), new Date(), { addSuffix: true })}</span>
        )}
        {interactionState.showMultiCursor && (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => {
              // copy multiCursor position
              navigator.clipboard.writeText(multiCursorPositionString);
              // Set focus back to Grid
              focusGrid();
            }}
          >
            Selection: {multiCursorPositionString}
          </span>
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <span>✓ Python 3.9.5</span>
        <span>✓ Quadratic {process.env.REACT_APP_VERSION}</span>
        <span
          style={{
            color: '#ffffff',
            backgroundColor: colors.quadraticThird,
            padding: '2px 5px 2px 5px',
            borderRadius: '2px',
          }}
        >
          ALPHA
        </span>
      </Box>
    </div>
  );
};
