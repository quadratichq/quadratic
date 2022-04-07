import { Box } from '@mui/system';
import colors from '../../../theme/colors';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { useEffect, useState } from 'react';
import { Cell } from '../../../core/gridDB/db';
import { GetCellsDB } from '../../../core/gridDB/Cells/GetCellsDB';
import { formatDistance } from 'date-fns';

export const BottomBar = () => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const [selectedCell, setSelectedCell] = useState<Cell | undefined>();

  const cursorPositionString = `(${interactionState.cursorPosition.x}, ${interactionState.cursorPosition.y})`;
  const multiCursorPositionString = `(${interactionState.multiCursorPosition.originPosition.x}, ${interactionState.multiCursorPosition.originPosition.y}), (${interactionState.multiCursorPosition.terminalPosition.x}, ${interactionState.multiCursorPosition.terminalPosition.y})`;

  useEffect(() => {
    const updateCellData = async () => {
      const cells = await GetCellsDB(
        interactionState.cursorPosition.x,
        interactionState.cursorPosition.y,
        interactionState.cursorPosition.x,
        interactionState.cursorPosition.y
      );

      if (cells.length) {
        const cell = cells[0];

        setSelectedCell(cell);
      } else {
        setSelectedCell(undefined);
      }
    };
    updateCellData();
  }, [interactionState]);

  return (
    <Box
      sx={{
        position: 'fixed',
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
            navigator.clipboard.writeText(cursorPositionString);
          }}
        >
          Cursor: {cursorPositionString}
        </span>
        {selectedCell?.last_modified && (
          <span>
            You,{' '}
            {formatDistance(
              Date.parse(selectedCell.last_modified),
              new Date(),
              { addSuffix: true }
            )}
          </span>
        )}
        {interactionState.showMultiCursor && (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => {
              navigator.clipboard.writeText(multiCursorPositionString);
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
        <span>✓ WebGL</span>
        <span>✓ Python</span>
        <span>✕ SQL</span>
        <span>✕ JS</span>
      </Box>
    </Box>
  );
};
