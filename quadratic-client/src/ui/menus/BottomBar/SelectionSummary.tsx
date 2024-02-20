import { useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { sheets } from '../../../grid/controller/Sheets';
// import { getColumnA1Notation, getRowA1Notation } from '../../../gridGL/UI/gridHeadings/getA1Notation';
import { TooltipHint } from '@/ui/components/TooltipHint';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import BottomBarItem from './BottomBarItem';

export const SelectionSummary = () => {
  const cursor = sheets.sheet.cursor;
  const decimal_places = 9;

  const isBigEnoughForActiveSelectionStats = useMediaQuery('(min-width:1000px)');
  const [count, setCount] = useState<string | undefined>('');
  const [sum, setSum] = useState<string | undefined>('');
  const [avg, setAvg] = useState<string | undefined>('');
  const [copied, setCopied] = useState(false);

  const runCalculationOnActiveSelection = async () => {
    let result = await quadraticCore.summarizeSelection(
      decimal_places,
      sheets.sheet.id,
      sheets.sheet.cursor.getRectangle()
    );
    console.log(result);
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

  const handleOnClick = (valueToCopy: string) => {
    navigator.clipboard.writeText(valueToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tooltipTitle = copied ? 'Copied!' : 'Copy to clipboard';

  if (isBigEnoughForActiveSelectionStats && cursor.multiCursor)
    return (
      <>
        {sum && (
          <TooltipHint title={tooltipTitle}>
            <BottomBarItem onClick={() => handleOnClick(sum)}>Sum: {sum}</BottomBarItem>
          </TooltipHint>
        )}
        {avg && (
          <TooltipHint title={tooltipTitle}>
            <BottomBarItem onClick={() => handleOnClick(avg)}>Avg: {avg}</BottomBarItem>
          </TooltipHint>
        )}
        {count && (
          <TooltipHint title={tooltipTitle}>
            <BottomBarItem onClick={() => handleOnClick(count)}>Count: {count}</BottomBarItem>
          </TooltipHint>
        )}
      </>
    );
  else return null;
};
