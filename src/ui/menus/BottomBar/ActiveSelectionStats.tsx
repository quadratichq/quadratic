import { useState, useEffect } from 'react';
import { runFormula } from '../../../grid/computations/formulas/runFormula';
import { getColumnA1Notation, getRowA1Notation } from '../../../gridGL/UI/gridHeadings/getA1Notation';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { useMediaQuery } from '@mui/material';

interface Props {
  interactionState: GridInteractionState;
}

const SELECTION_SIZE_LIMIT = 250;

export const ActiveSelectionStats = (props: Props) => {
  const {
    showMultiCursor,
    multiCursorPosition: { originPosition, terminalPosition },
  } = props.interactionState;

  const isBigEnoughForActiveSelectionStats = useMediaQuery('(min-width:1000px)');
  const [countA, setCountA] = useState<string>('');
  const [sum, setSum] = useState<string>('');
  const [avg, setAvg] = useState<string>('');

  // Run async calculations to get the count/avg/sum meta info
  useEffect(() => {
    if (showMultiCursor) {
      const runCalculationOnActiveSelection = async () => {
        const width = Math.abs(originPosition.x - terminalPosition.x) + 1;
        const height = Math.abs(originPosition.y - terminalPosition.y) + 1;
        const totalArea = width * height;
        if (totalArea > SELECTION_SIZE_LIMIT) {
          setCountA('');
          setAvg('');
          setSum('');
          return;
        }

        // Get values around current selection
        const colStart = getColumnA1Notation(originPosition.x);
        const rowStart = getRowA1Notation(originPosition.y);
        const colEnd = getColumnA1Notation(terminalPosition.x);
        const rowEnd = getRowA1Notation(terminalPosition.y);
        const range = `${colStart}${rowStart}:${colEnd}${rowEnd}`;
        const pos = { x: originPosition.x - 1, y: originPosition.y - 1 };

        // Get the number of cells with at least some data
        const countAReturn = await runFormula(`COUNTA(${range})`, pos);
        const countA = countAReturn.success ? Number(countAReturn.output_value) : 0;
        setCountA(countA.toString());

        // If we don't have at least 2 cells with data and one
        // of those is a number, don't bother with sum and avg
        const countReturn = await runFormula(`COUNT(${range})`, pos);
        const countCellsWithNumbers = countReturn.success ? Number(countReturn.output_value) : 0;
        if (countA < 2 || countCellsWithNumbers < 1) {
          setAvg('');
          setSum('');
          return;
        }

        // Run the formulas
        const sumReturn = await runFormula(`SUM(${range})`, pos);
        if (sumReturn.success && sumReturn.output_value) {
          setSum(sumReturn.output_value);
        } else {
          console.error('Error running `sum` formula: ', sumReturn.error_msg);
          setSum('');
        }
        const avgReturn = await runFormula(`AVERAGE(${range})`, pos);
        if (avgReturn.success && avgReturn.output_value) {
          setAvg(avgReturn.output_value);
        } else {
          console.error('Error running `avg` formula: ', avgReturn.error_msg);
          setAvg('');
        }
      };
      runCalculationOnActiveSelection();
    }
  }, [originPosition, showMultiCursor, terminalPosition]);

  if (isBigEnoughForActiveSelectionStats && showMultiCursor)
    return (
      <>
        {sum && <span>Sum: {sum}</span>}
        {avg && <span>Avg: {avg}</span>}
        {countA && <span>Count: {countA}</span>}
      </>
    );
  else return null;
};
