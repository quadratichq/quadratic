import type { DateTimeRange } from '@/app/quadratic-core-types';
import { numberToTime, userTimeToNumber } from '@/app/quadratic-rust-client/quadratic_rust_client';
import type { ValidationDateTimeData } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/useValidationDateTime';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationInput';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/shadcn/ui/accordion';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCallback, useMemo, useState } from 'react';

interface Props {
  dateTimeData: ValidationDateTimeData;
  onEnter: () => void;
}

export const ValidationTimeRanges = (props: Props) => {
  const { dateTimeData, onEnter } = props;
  const {
    readOnly,
    validationDateTime,
    setValidationDateTime,
    timeEquals,
    timeRequire,
    noTimeHelp,
    timeEqualsSetHelp,
  } = dateTimeData;

  const ranges: DateTimeRange[] = useMemo(() => {
    const ranges: DateTimeRange[] = validationDateTime.ranges.filter((r) => 'TimeRange' in r);

    // always add an empty range to the bottom of the list
    if (!ranges.find((r) => 'TimeRange' in r && r.TimeRange[0] === null && r.TimeRange[1] === null)) {
      ranges.push({ TimeRange: [null, null] });
    }
    return ranges;
  }, [validationDateTime.ranges]);

  const [rangeError, setRangeError] = useState<Map<number, { text: string; type: string }>>(new Map());

  const updateRangeError = (index: number, text?: string, type?: string) => {
    setRangeError((rangeError) => {
      const newRangeError = new Map(rangeError);
      if (text && type) {
        newRangeError.set(index, { text, type });
      } else {
        newRangeError.delete(index);
      }
      return newRangeError;
    });
  };

  const changeRange = useCallback(
    (index: number, value: string, type: 'start' | 'end') => {
      let time: number | null;
      if (value.trim() === '') {
        // if we're in a new range, then we can just return because there's
        // nothing to update.
        if (index === -1) return;
        time = null;
      } else {
        time = userTimeToNumber(value) ?? null;
        if (!time) {
          updateRangeError(index, `Invalid ${type} time`, type);
          return;
        }
      }

      let current: DateTimeRange;
      if (index === -1) {
        current = { TimeRange: [null, null] };
      } else {
        current = validationDateTime.ranges[index];
      }
      if (!('TimeRange' in current)) throw new Error('Expected TimeRange in changeRange');

      if (type === 'start') {
        // check for error (min > max)
        if (current.TimeRange[1] !== null && time && time > current.TimeRange[1]) {
          updateRangeError(index, 'Range start must be before end', type);
          return;
        }

        current.TimeRange[0] = time ? time : null;

        // remove any errors in this range
        updateRangeError(index);
      } else {
        // check for error (max < min)
        if (current.TimeRange[0] !== null && time && time < current.TimeRange[0]) {
          updateRangeError(index, 'Range end must be after start', type);
          return;
        }
        current.TimeRange[1] = time ? time : null;

        // remove any errors in this range
        updateRangeError(index);
      }

      const newRanges: DateTimeRange[] = validationDateTime.ranges.filter((_, i) => i !== index);
      newRanges.push(current);

      setValidationDateTime({
        ...validationDateTime,
        ranges: newRanges,
      });
    },
    [setValidationDateTime, validationDateTime]
  );

  const removeRange = useCallback(
    (index: number) => {
      const ranges = [...validationDateTime.ranges];
      ranges.splice(index, 1);
      setValidationDateTime({
        ...validationDateTime,
        ranges,
      });
      updateRangeError(index);
    },
    [setValidationDateTime, validationDateTime]
  );

  //#endregion

  const findRangeIndex = (range: DateTimeRange): number => {
    // return if we're adding a new range
    if (!('TimeRange' in range) || (range.TimeRange[0] === null && range.TimeRange[1] === null)) return -1;

    const i = validationDateTime.ranges.findIndex((r: DateTimeRange) => {
      if (!('TimeRange' in range) || !('TimeRange' in r)) return false;

      return r.TimeRange[0] === range.TimeRange[0] && r.TimeRange[1] === range.TimeRange[1];
    });
    if (i === -1) {
      throw new Error('Range not found in findRangeIndex in ValidationDateTime');
    }
    return i;
  };

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      defaultValue={ranges.length > 1 ? 'time-range' : undefined}
      value={timeEquals?.length ? '' : undefined}
    >
      <AccordionItem value="time-range">
        <AccordionTrigger
          className={timeRequire === 'prohibit' || timeEquals.length ? 'opacity-50' : ''}
          disabled={timeRequire === 'prohibit' || !!timeEquals.length}
        >
          {' '}
          <div className="flex">
            Time ranges{noTimeHelp}
            {timeEqualsSetHelp}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-1 pt-1">
          {ranges.map((range, index) => {
            const i = findRangeIndex(range);
            const r = 'TimeRange' in range ? range.TimeRange : [null, null];
            const start = r[0] ? numberToTime(r[0]) : undefined;
            const end = r[1] ? numberToTime(r[1]) : undefined;
            return (
              <div className="flex w-full flex-col" key={index}>
                <div className="mb-2 flex w-full gap-2">
                  <ValidationInput
                    className="w-full"
                    placeholder="Start Time"
                    disabled={readOnly}
                    value={start}
                    onChange={(value) => changeRange(i, value, 'start')}
                    onEnter={onEnter}
                    clear={rangeError.get(i)?.type === 'start'}
                    error={rangeError.get(i)?.type === 'start' ? rangeError.get(i)?.text : undefined}
                  />
                  <ValidationInput
                    placeholder="End Time"
                    disabled={readOnly}
                    value={end}
                    onChange={(value) => changeRange(i, value, 'end')}
                    onEnter={onEnter}
                    clear={rangeError.get(i)?.type === 'end'}
                    error={rangeError.get(i)?.type === 'end' ? rangeError.get(i)?.text : undefined}
                  />
                  <Button className={cn('grow-0 px-2', i !== -1 ? '' : 'invisible')} onClick={() => removeRange(i)}>
                    <DeleteIcon />
                  </Button>
                </div>
              </div>
            );
          })}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
