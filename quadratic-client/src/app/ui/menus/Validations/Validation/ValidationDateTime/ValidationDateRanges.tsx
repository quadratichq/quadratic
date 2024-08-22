import { DateTimeRange } from '@/app/quadratic-core-types';
import { numberToDate, userDateToNumber } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { ValidationCalendar } from '@/app/ui/menus/Validations/Validation/ValidationCalendar';
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

export const ValidationDateRanges = (props: Props) => {
  const { dateTimeData, onEnter } = props;
  const { readOnly, validationDateTime, setValidationDateTime, equals, dateRequire, noDateHelp, equalsSetHelp } =
    dateTimeData;

  const ranges: DateTimeRange[] = useMemo(() => {
    const ranges: DateTimeRange[] = [];
    validationDateTime.ranges.forEach((r) => {
      if ('DateRange' in r) {
        ranges.push(r);
      }
    });

    // always add an empty range to the bottom of the list
    if (!ranges.find((r) => 'DateRange' in r && r.DateRange[0] === null && r.DateRange[1] === null)) {
      ranges.push({ DateRange: [null, null] });
    }
    return ranges;
  }, [validationDateTime.ranges]);

  const [rangeError, setRangeError] = useState<number[]>([]);
  const changeRange = useCallback(
    (index: number, value: string, type: 'start' | 'end') => {
      let date: bigint | null;
      if (value.trim() === '') {
        date = null;
      } else {
        date = userDateToNumber(value) ?? null;
        if (!date) {
          setRangeError((rangeError) => {
            const r = rangeError.filter((r) => r !== index);
            r.push(index);
            return r;
          });
          return;
        }
      }

      let current: DateTimeRange;
      if (index === -1) {
        current = { DateRange: [null, null] };
      } else {
        current = validationDateTime.ranges[index];
      }
      if (!('DateRange' in current)) throw new Error('Expected Range in changeRange');

      if (type === 'start') {
        // check for error (min > max)
        if (current.DateRange[1] !== null && date && date > current.DateRange[1]) {
          setRangeError((rangeError) => {
            const r = rangeError.filter((r) => r !== index);
            r.push(index);
            return r;
          });
          return;
        }

        current.DateRange[0] = date ? date : null;

        // remove any errors in this range
        setRangeError((rangeError) => {
          return rangeError.filter((r) => r !== index);
        });
      } else {
        // check for error (max < min)
        if (current.DateRange[0] !== null && date && date < current.DateRange[0]) {
          setRangeError((rangeError) => {
            const r = rangeError.filter((r) => r !== index);
            r.push(index);
            return r;
          });
          return;
        }
        current.DateRange[1] = date ? BigInt(date) : null;

        // remove any errors in this range
        setRangeError((rangeError) => {
          return rangeError.filter((r) => r !== index);
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
    if (!('DateRange' in range) || (range.DateRange[0] === null && range.DateRange[1] === null)) return -1;

    const i = validationDateTime.ranges.findIndex((r: DateTimeRange) => {
      if (!('DateRange' in range) || !('DateRange' in r)) return false;

      return r.DateRange[0] === range.DateRange[0] && r.DateRange[1] === range.DateRange[1];
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
      defaultValue={ranges.length > 1 ? 'date-range' : undefined}
      value={equals?.length ? '' : undefined}
    >
      <AccordionItem value="date-range">
        <AccordionTrigger
          className={dateRequire === 'prohibit' || equals.length ? 'opacity-50' : ''}
          disabled={dateRequire === 'prohibit' || !!equals.length}
        >
          {' '}
          <div className="flex">
            Date ranges{noDateHelp}
            {equalsSetHelp}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-1 pt-1">
          {ranges.map((range, index) => {
            const i = findRangeIndex(range);
            const r = 'DateRange' in range ? range.DateRange : [null, null];
            const start = r[0] ? numberToDate(BigInt(r[0])) : undefined;
            const end = r[1] ? numberToDate(BigInt(r[1])) : undefined;
            return (
              <div className="flex w-full flex-col" key={index}>
                <div className="mb-4 flex w-full items-center gap-2">
                  <div className="flex w-full flex-col gap-2">
                    <ValidationInput
                      className="w-full"
                      placeholder="Start Date"
                      disabled={readOnly}
                      value={start}
                      onChange={(value) => changeRange(i, value, 'start')}
                      onEnter={onEnter}
                      showOnFocus={
                        <ValidationCalendar
                          singleDate
                          dates={start ? [new Date(start)] : []}
                          setDates={(dates) => {
                            changeRange(i, dates, 'start');
                            return true;
                          }}
                          fallbackMonth={end ? new Date(end) : undefined}
                        />
                      }
                    />
                    <ValidationInput
                      placeholder="End Date"
                      disabled={readOnly}
                      value={end}
                      onChange={(value) => changeRange(i, value, 'end')}
                      onEnter={onEnter}
                      showOnFocus={
                        <ValidationCalendar
                          singleDate
                          dates={end ? [new Date(end)] : undefined}
                          fallbackMonth={start ? new Date(start) : undefined}
                          setDates={(dates) => {
                            changeRange(i, dates, 'end');
                            return true;
                          }}
                        />
                      }
                    />
                  </div>
                  <Button className={cn('grow-0 px-2', i !== -1 ? '' : 'invisible')} onClick={() => removeRange(i)}>
                    <DeleteIcon />
                  </Button>
                </div>
                {rangeError.includes(i) && (
                  <div className="mb-2 text-xs text-red-500">Range start must be before end</div>
                )}
              </div>
            );
          })}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
