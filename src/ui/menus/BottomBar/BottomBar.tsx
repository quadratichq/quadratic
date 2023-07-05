import { Box } from '@mui/system';
import { colors } from '../../../theme/colors';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { useEffect, useState } from 'react';
import { Cell } from '../../../schemas';
import { formatDistance } from 'date-fns';
import { focusGrid } from '../../../helpers/focusGrid';
import { isMobileOnly } from 'react-device-detect';
import { debugShowCacheFlag, debugShowFPS, debugShowRenderer, debugShowCacheCount } from '../../../debugFlags';
import { Sheet } from '../../../grid/sheet/Sheet';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { ChatBubbleOutline } from '@mui/icons-material';
import { runFormula } from '../../../grid/computations/formulas/runFormula';
import { getColumnA1Notation, getRowA1Notation } from '../../../gridGL/UI/gridHeadings/getA1Notation';

interface Props {
  sheet: Sheet;
}

interface Output {
  sum: string;
  avg: string;
}

export const BottomBar = (props: Props) => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [selectedCell, setSelectedCell] = useState<Cell | undefined>();
  const [output, setOutput] = useState<Output | undefined>();
  const { sheet } = props;
  const {
    showMultiCursor,
    cursorPosition,
    multiCursorPosition: { originPosition, terminalPosition },
  } = interactionState;

  // Generate string describing cursor location
  const cursorPositionString = `(${cursorPosition.x}, ${cursorPosition.y})`;
  const multiCursorPositionString = `(${originPosition.x}, ${originPosition.y}), (${terminalPosition.x}, ${terminalPosition.y})`;

  // Get the number of cells with values
  const count = sheet.grid.getNakedCells(
    originPosition.x,
    originPosition.y,
    terminalPosition.x,
    terminalPosition.y
  ).length;

  useEffect(() => {
    if (showMultiCursor) {
      const runCalculationOnActiveSelection = async () => {
        // Don't bother if we don't have at least two cells with values
        if (count < 2) {
          setOutput(undefined);
          return;
        }

        // TODO only run the formulas if there are at least two with numbers
        // at which point we can expect there to be a result

        // Run a formula on the selected cells
        const colStart = getColumnA1Notation(originPosition.x);
        const rowStart = getRowA1Notation(originPosition.y);
        const colEnd = getColumnA1Notation(terminalPosition.x);
        const rowEnd = getRowA1Notation(terminalPosition.y);
        const range = `${colStart}${rowStart}:${colEnd}${rowEnd}`;
        const pos = { x: originPosition.x - 1, y: originPosition.y - 1 };
        const sum = await runFormula(`IF(COUNT(${range}) >= 1, SUM(${range}), "")`, pos);
        const avg = await runFormula(`IF(COUNT(${range}) >= 1, AVERAGE(${range}), "")`, pos);

        if (sum.success && sum.output_value && avg.success && avg.output_value) {
          setOutput({ sum: sum.output_value, avg: avg.output_value });
        } else {
          // TODO This shouldn't trigger, it's an unexpected error
          console.log('formula message. sum: %s, avg: %s', sum.error_msg, avg.error_msg);
          setOutput(undefined);
        }
      };
      runCalculationOnActiveSelection();
    }
  }, [count, originPosition, showMultiCursor, terminalPosition]);

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
        {interactionState.showMultiCursor && (
          <>
            <span style={{ cursor: 'pointer' }} onClick={handleShowGoToMenu}>
              Selection: {multiCursorPositionString}
            </span>
            {count >= 2 && (
              <>
                <span>Count: {count}</span>
                {output && output.sum && <span>Sum: {output.sum}</span>}
                {output && output.avg && <span>Avg: {output.avg}</span>}
              </>
            )}
          </>
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
