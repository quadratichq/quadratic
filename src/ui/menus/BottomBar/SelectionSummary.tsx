import { useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { sheets } from '../../../grid/controller/Sheets';
// import { getColumnA1Notation, getRowA1Notation } from '../../../gridGL/UI/gridHeadings/getA1Notation';
import { grid } from '../../../grid/controller/Grid';
import BottomBarItem from './BottomBarItem';

export const SelectionSummary = () => {
  const cursor = sheets.sheet.cursor;

  const isBigEnoughForActiveSelectionStats = useMediaQuery('(min-width:1000px)');
  const [count, setCount] = useState<string | undefined>('');
  const [sum, setSum] = useState<string | undefined>('');
  const [avg, setAvg] = useState<string | undefined>('');

  const runCalculationOnActiveSelection = async () => {
    let result = await grid.summarizeSelection();

    if (result) {
      setCount(result.count.toString());
      setSum(result.sum !== undefined ? result.sum.toString() : undefined);
      setAvg(result.average !== undefined ? result.average.toString() : undefined);
    } else {
      setCount(undefined);
      setSum(undefined);
      setAvg(undefined);
    }
  };

  // Run async calculations to get the count/avg/sum meta info
  useEffect(() => {
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
        {count && <BottomBarItem>Count: {count}</BottomBarItem>}
      </>
    );
  else return null;
};
