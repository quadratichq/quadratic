import { useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { runFormula } from '../../../grid/computations/formulas/runFormula';
import { sheetController } from '../../../grid/controller/SheetController';
import { getColumnA1Notation, getRowA1Notation } from '../../../gridGL/UI/gridHeadings/getA1Notation';
import BottomBarItem from './BottomBarItem';

const SELECTION_SIZE_LIMIT = 250;

export const ActiveSelectionStats = () => {
  const cursor = sheetController.sheet.cursor;

  const isBigEnoughForActiveSelectionStats = useMediaQuery('(min-width:1000px)');
  const [countA, setCountA] = useState<string>('');
  const [sum, setSum] = useState<string>('');
  const [avg, setAvg] = useState<string>('');

  // Run async calculations to get the count/avg/sum meta info
  useEffect(() => {
    const runCalculationOnActiveSelection = async () => {
      const width = Math.abs(cursor.originPosition.x - cursor.terminalPosition.x) + 1;
      const height = Math.abs(cursor.originPosition.y - cursor.terminalPosition.y) + 1;
      const totalArea = width * height;
      if (totalArea > SELECTION_SIZE_LIMIT) {
        setCountA('');
        setAvg('');
        setSum('');
        return;
      }

      // Get values around current selection
      const colStart = getColumnA1Notation(cursor.originPosition.x);
      const rowStart = getRowA1Notation(cursor.originPosition.y);
      const colEnd = getColumnA1Notation(cursor.terminalPosition.x);
      const rowEnd = getRowA1Notation(cursor.terminalPosition.y);
      const range = `${colStart}${rowStart}:${colEnd}${rowEnd}`;
      const pos = { x: cursor.originPosition.x - 1, y: cursor.originPosition.y - 1 };

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
    if (cursor.multiCursor) {
      runCalculationOnActiveSelection();
    }
  }, [
    cursor.multiCursor,
    cursor.originPosition.x,
    cursor.originPosition.y,
    cursor.terminalPosition.x,
    cursor.terminalPosition.y,
  ]);

  if (isBigEnoughForActiveSelectionStats && cursor.multiCursor)
    return (
      <>
        {sum && <BottomBarItem>Sum: {sum}</BottomBarItem>}
        {avg && <BottomBarItem>Avg: {avg}</BottomBarItem>}
        {countA && <BottomBarItem>Count: {countA}</BottomBarItem>}
      </>
    );
  else return null;
};
