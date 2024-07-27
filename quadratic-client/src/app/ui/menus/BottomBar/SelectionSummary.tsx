import { useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import BottomBarItem from '@/app/ui/menus/BottomBar/BottomBarItem';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export const SelectionSummary = () => {
  const decimal_places = 9;

  const isBigEnoughForActiveSelectionStats = useMediaQuery('(min-width:1000px)');
  const [count, setCount] = useState<string | undefined>('');
  const [sum, setSum] = useState<string | undefined>('');
  const [avg, setAvg] = useState<string | undefined>('');
  const [copied, setCopied] = useState(false);

  const cursor = sheets.sheet.cursor;

  // Run async calculations to get the count/avg/sum meta info
  useEffect(() => {
    const runCalculationOnActiveSelection = async () => {
      if (!cursor.multiCursor && !cursor.columnRow) return;
      let result = await quadraticCore.summarizeSelection(decimal_places, sheets.sheet.cursor.getRustSelection());
      if (result) {
        setCount(result.count.toString());
        setSum(result.sum === null ? undefined : result.sum.toString());
        setAvg(result.average === null ? undefined : result.average.toString());
      } else {
        setCount(undefined);
        setSum(undefined);
        setAvg(undefined);
      }
    };

    events.on('cursorPosition', runCalculationOnActiveSelection);
    return () => {
      events.off('cursorPosition', runCalculationOnActiveSelection);
    };
  }, [cursor.columnRow, cursor.multiCursor]);

  const handleOnClick = (valueToCopy: string) => {
    navigator.clipboard.writeText(valueToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tooltipTitle = copied ? 'Copied!' : 'Copy to clipboard';

  if (isBigEnoughForActiveSelectionStats && (cursor.multiCursor || cursor.columnRow))
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
