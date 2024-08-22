import { DateTimeRange } from '@/app/quadratic-core-types';
import { numberToTime, userTimeToNumber } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { ValidationDateTimeData } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/useValidationDateTime';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI';
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
    const ranges: DateTimeRange[] = [];
    validationDateTime.ranges.forEach((r) => {
      if ('TimeRange' in r) {
        ranges.push(r);
      }
    });

    // always add an empty range to the bottom of the list
    if (!ranges.find((r) => 'TimeRange' in r && r.TimeRange[0] === null && r.TimeRange[1] === null)) {
      ranges.push({ TimeRange: [null, null] });
    }
    return ranges;
  }, [validationDateTime.ranges]);

  //todo: make this also track the type so we can move it under the correct box
  const [rangeError, setRangeError] = useState<Map<number, string>>(new Map());
  const changeRange = useCallback(
    (index: number, value: string, type: 'start' | 'end') => {
      let time: number | null;
      if (value.trim() === '') {
        time = null;
      } else {
        time = userTimeToNumber(value) ?? null;
        if (!time) {
          setRangeError((rangeError) => {
            const newRangeError = new Map(rangeError);
            newRangeError.set(index, `Invalid ${type} time`);
            return newRangeError;
          });
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
          setRangeError((rangeError) => {
            const newRangeError = new Map(rangeError);
            newRangeError.set(index, 'Range start must be before end');
            return newRangeError;
          });
          return;
        }

        current.TimeRange[0] = time ? time : null;

        // remove any errors in this range
        setRangeError((rangeError) => {
          const newRangeError = new Map(rangeError);
          newRangeError.delete(index);
          return newRangeError;
        });
      } else {
        // check for error (max < min)
        if (current.TimeRange[0] !== null && time && time < current.TimeRange[0]) {
          setRangeError((rangeError) => {
            const newRangeError = new Map(rangeError);
            newRangeError.set(index, 'Range end must be after start');
            return newRangeError;
          });
          return;
        }
        current.TimeRange[1] = time ? time : null;

        // remove any errors in this range
        setRangeError((rangeError) => {
          const newRangeError = new Map(rangeError);
          newRangeError.delete(index);
          return newRangeError;
        });
      }

      const ranges: DateTimeRange[] = validationDateTime.ranges.filter((_, i) => i !== index);
      ranges.push(current);

      setValidationDateTime({
        ...validationDateTime,
        ranges,
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
                <div className="mb-2 flex w-full items-center gap-2">
                  <ValidationInput
                    className="w-full"
                    placeholder="Start Time"
                    disabled={readOnly}
                    value={start}
                    onChange={(value) => changeRange(i, value, 'start')}
                    onEnter={onEnter}
                  />
                  <ValidationInput
                    placeholder="End Time"
                    disabled={readOnly}
                    value={end}
                    onChange={(value) => changeRange(i, value, 'end')}
                    onEnter={onEnter}
                  />
                  <Button className={cn('grow-0 px-2', i !== -1 ? '' : 'invisible')} onClick={() => removeRange(i)}>
                    <DeleteIcon />
                  </Button>
                </div>
                {rangeError.has(i) && (
                  <div style={{ marginTop: '-0.5rem' }} className="mb-2 text-xs text-red-500">
                    {rangeError.get(i)}
                  </div>
                )}
              </div>
            );
          })}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
