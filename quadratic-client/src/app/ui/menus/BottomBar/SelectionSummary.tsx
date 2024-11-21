import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import BottomBarItem from '@/app/ui/menus/BottomBar/BottomBarItem';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { useMediaQuery } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SHOW_SELECTION_SUMMARY_DELAY = 500;
const DECIMAL_PLACES = 2;

export const SelectionSummary = () => {
  const isBigEnoughForActiveSelectionStats = useMediaQuery('(min-width:1000px)');
  const [count, setCount] = useState<string | undefined>('');
  const [sum, setSum] = useState<string | undefined>('');
  const [avg, setAvg] = useState<string | undefined>('');
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

  // Run async calculations to get the count/avg/sum meta info
  const showSelectionSummary = useCallback(async () => {
    const cursor = sheets.sheet.cursor;
    if (!cursor.isMultiCursor() && !cursor.isColumnRow()) {
      setCount(undefined);
      setSum(undefined);
      setAvg(undefined);
      return;
    }

    let result = await quadraticCore.summarizeSelection(DECIMAL_PLACES, sheets.getRustSelection());
    if (result) {
      setCount(result.count.toString());
      setSum(result.sum === undefined ? undefined : result.sum.toString());
      setAvg(result.average === undefined ? undefined : result.average.toString());
    } else {
      setCount(undefined);
      setSum(undefined);
      setAvg(undefined);
    }
  }, []);

  const updateSelectionSummary = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setCount(undefined);
    setSum(undefined);
    setAvg(undefined);

    timeoutRef.current = setTimeout(() => {
      showSelectionSummary();
    }, SHOW_SELECTION_SUMMARY_DELAY);
  }, [showSelectionSummary]);

  useEffect(() => {
    events.on('cursorPosition', updateSelectionSummary);
    events.on('changeSheet', updateSelectionSummary);
    events.on('hashContentChanged', updateSelectionSummary);

    return () => {
      events.off('cursorPosition', updateSelectionSummary);
      events.off('changeSheet', updateSelectionSummary);
      events.off('hashContentChanged', updateSelectionSummary);
    };
  }, [updateSelectionSummary]);

  const handleOnClick = useCallback((valueToCopy: string) => {
    navigator.clipboard.writeText(valueToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const tooltipTitle = useMemo(() => (copied ? 'Copied!' : 'Copy to clipboard'), [copied]);

  if (!isBigEnoughForActiveSelectionStats) return null;

  const cursor = sheets.sheet.cursor;
  if (!cursor.isMultiCursor() && !cursor.isColumnRow()) return null;

  return (
    <>
      {sum && (
        <TooltipPopover label={tooltipTitle}>
          <BottomBarItem
            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
              e.stopPropagation();
              e.preventDefault();
              handleOnClick(sum);
            }}
            onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            Sum: {sum}
          </BottomBarItem>
        </TooltipPopover>
      )}

      {avg && (
        <TooltipPopover label={tooltipTitle}>
          <BottomBarItem
            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
              e.stopPropagation();
              e.preventDefault();
              handleOnClick(avg);
            }}
            onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            Avg: {avg}
          </BottomBarItem>
        </TooltipPopover>
      )}

      {count && (
        <TooltipPopover label={tooltipTitle}>
          <BottomBarItem
            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
              e.stopPropagation();
              e.preventDefault();
              handleOnClick(count);
            }}
            onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            Count: {count}
          </BottomBarItem>
        </TooltipPopover>
      )}
    </>
  );
};
