import { useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';
import { sheets } from '../../../grid/controller/Sheets';
// import { getColumnA1Notation, getRowA1Notation } from '../../../gridGL/UI/gridHeadings/getA1Notation';
import { events } from '@/app/events/events';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import BottomBarItem from './BottomBarItem';

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
      if (!cursor.multiCursor && !cursor.columnRow) {
        setCount(undefined);
        setSum(undefined);
        setAvg(undefined);
        return;
      }

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
          <TooltipPopover label={tooltipTitle}>
            <BottomBarItem onClick={() => handleOnClick(sum)}>Sum: {sum}</BottomBarItem>
          </TooltipPopover>
        )}

        {avg && (
          <TooltipPopover label={tooltipTitle}>
            <BottomBarItem onClick={() => handleOnClick(avg)}>Avg: {avg}</BottomBarItem>
          </TooltipPopover>
        )}

        {count && (
          <TooltipPopover label={tooltipTitle}>
            <BottomBarItem onClick={() => handleOnClick(count)}>Count: {count}</BottomBarItem>
          </TooltipPopover>
        )}
      </>
    );
  else return null;
};
