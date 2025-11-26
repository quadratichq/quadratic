import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SHOW_SELECTION_SUMMARY_DELAY = 500;
const DECIMAL_PLACES = 2;
const STORAGE_KEY = 'quadratic-selection-summary-type';

type SummaryType = 'count' | 'sum' | 'avg' | null;

const getStoredType = (): SummaryType => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'count' || stored === 'sum' || stored === 'avg') {
    return stored;
  }
  return null;
};

const setStoredType = (type: SummaryType) => {
  if (typeof window === 'undefined') return;
  if (type) {
    localStorage.setItem(STORAGE_KEY, type);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const SelectionSummaryDropdown = () => {
  const [count, setCount] = useState<string | undefined>('');
  const [sum, setSum] = useState<string | undefined>('');
  const [avg, setAvg] = useState<string | undefined>('');
  const [selectedType, setSelectedType] = useState<SummaryType>(getStoredType());
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

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
      setSum(result.sum === null ? undefined : result.sum.toString());
      setAvg(result.average === null ? undefined : result.average.toString());
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

  // Auto-select default stat (prefer sum, then count, then avg)
  useEffect(() => {
    const currentType = selectedType || getStoredType();

    if (currentType === null) {
      // Default to sum, then count, then avg
      if (sum) {
        const newType: SummaryType = 'sum';
        setSelectedType(newType);
        setStoredType(newType);
      } else if (count) {
        const newType: SummaryType = 'count';
        setSelectedType(newType);
        setStoredType(newType);
      } else if (avg) {
        const newType: SummaryType = 'avg';
        setSelectedType(newType);
        setStoredType(newType);
      }
    } else {
      // If selected type is no longer available, switch to default priority
      if (currentType === 'count' && !count) {
        if (sum) {
          setSelectedType('sum');
          setStoredType('sum');
        } else if (avg) {
          setSelectedType('avg');
          setStoredType('avg');
        } else {
          setSelectedType(null);
          setStoredType(null);
        }
      } else if (currentType === 'sum' && !sum) {
        if (count) {
          setSelectedType('count');
          setStoredType('count');
        } else if (avg) {
          setSelectedType('avg');
          setStoredType('avg');
        } else {
          setSelectedType(null);
          setStoredType(null);
        }
      } else if (currentType === 'avg' && !avg) {
        if (sum) {
          setSelectedType('sum');
          setStoredType('sum');
        } else if (count) {
          setSelectedType('count');
          setStoredType('count');
        } else {
          setSelectedType(null);
          setStoredType(null);
        }
      } else if (currentType && !selectedType) {
        // Restore from storage if available
        setSelectedType(currentType);
      }
    }
  }, [count, sum, avg, selectedType]);

  const handleCopy = useCallback((value: string) => {
    navigator.clipboard.writeText(value);
  }, []);

  const displayValue = useMemo(() => {
    if (selectedType === 'count' && count) return `Count: ${count}`;
    if (selectedType === 'sum' && sum) return `Sum: ${sum}`;
    if (selectedType === 'avg' && avg) return `Avg: ${avg}`;
    return null;
  }, [selectedType, count, sum, avg]);

  const cursor = sheets.sheet.cursor;
  if (!cursor.isMultiCursor() && !cursor.isColumnRow()) return null;

  const availableTypes: SummaryType[] = [];
  if (count) availableTypes.push('count');
  if (sum) availableTypes.push('sum');
  if (avg) availableTypes.push('avg');

  if (availableTypes.length === 0) return null;

  if (!displayValue) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-8 items-center gap-1 border-t border-border bg-accent px-2 text-xs text-muted-foreground hover:bg-border focus:outline-none"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
      >
        <span>{displayValue}</span>
        <ArrowDropDownIcon className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuRadioGroup
          value={selectedType || undefined}
          onValueChange={(value) => {
            const newType = value as SummaryType;
            setSelectedType(newType);
            setStoredType(newType);
          }}
        >
          {count && (
            <DropdownMenuRadioItem
              value="count"
              onClick={(e) => {
                e.stopPropagation();
                if (count) handleCopy(count);
              }}
            >
              Count: {count}
            </DropdownMenuRadioItem>
          )}
          {sum && (
            <DropdownMenuRadioItem
              value="sum"
              onClick={(e) => {
                e.stopPropagation();
                if (sum) handleCopy(sum);
              }}
            >
              Sum: {sum}
            </DropdownMenuRadioItem>
          )}
          {avg && (
            <DropdownMenuRadioItem
              value="avg"
              onClick={(e) => {
                e.stopPropagation();
                if (avg) handleCopy(avg);
              }}
            >
              Avg: {avg}
            </DropdownMenuRadioItem>
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
