import { DateTimeRange } from '@/app/quadratic-core-types';
import { numberToDate, userDateToNumber } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { ValidationCalendar } from '@/app/ui/menus/Validations/Validation/ValidationCalendar';
import { ValidationDateTimeData } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/useValidationDateTime';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/shadcn/ui/accordion';
import { useCallback, useMemo, useState } from 'react';

interface Props {
  dateTimeData: ValidationDateTimeData;
  onEnter: () => void;
}

export const ValidationsDateEquals = (props: Props) => {
  const { onEnter, dateTimeData } = props;
  const { readOnly, validationDateTime, setValidationDateTime, equals, dateRequire, noDateHelp, equalsSetHelp } =
    dateTimeData;

  const [equalsError, setEqualsError] = useState(false);
  const [notEqualsError, setNotEqualsError] = useState(false);

  const datesStringToNumber = (date: string): bigint[] | undefined => {
    const split = date.split(',');
    const dates: bigint[] = [];
    for (const v of split) {
      if (v.trim()) {
        const parsed = userDateToNumber(v.trim());
        if (parsed) {
          dates.push(parsed);
        } else {
          return;
        }
      }
    }
    return dates;
  };

  const changeEquals = useCallback(
    (values: string) => {
      if (values.trim() === '') {
        setValidationDateTime({
          ...validationDateTime,
          ranges: validationDateTime.ranges.filter((m) => !('DateEqual' in m)),
        });
        setEqualsError(false);
        return;
      }

      const dates = datesStringToNumber(values);
      if (!dates) {
        setEqualsError(true);
        return;
      }

      setEqualsError(false);

      if (!dates.length) {
        setValidationDateTime({
          ...validationDateTime,
          ranges: validationDateTime.ranges.filter((m) => !('DateEqual' in m)),
        });
      } else {
        // DateEqual can only exist with other time rules; not with other date rules
        const ranges: DateTimeRange[] = validationDateTime.ranges.filter(
          (m) => 'TimeEqual' in m || 'TimeNotEqual' in m || 'TimeRange' in m
        );
        ranges.push({
          DateEqual: dates,
        });
        setValidationDateTime({
          ...validationDateTime,
          ranges,
        });
      }
    },
    [setValidationDateTime, validationDateTime]
  );

  const notEquals = useMemo(() => {
    const notEquals = validationDateTime.ranges.find((r) => 'DateNotEqual' in r);
    if (notEquals && 'DateNotEqual' in notEquals) {
      return notEquals.DateNotEqual.flatMap((d) => {
        const date = numberToDate(BigInt(d));
        if (date) {
          return [date];
        } else {
          return [];
        }
      });
    } else {
      return [];
    }
  }, [validationDateTime.ranges]);

  const changeNotEquals = useCallback(
    (values: string) => {
      if (values.trim() === '') {
        setValidationDateTime({
          ...validationDateTime,
          ranges: validationDateTime.ranges.filter((m) => !('DateNotEqual' in m)),
        });
        setNotEqualsError(false);
        return;
      }

      const dates = datesStringToNumber(values);
      if (!dates) {
        setNotEqualsError(true);
        return;
      }
      setNotEqualsError(false);

      const ranges = validationDateTime.ranges.filter((m) => !('DateNotEqual' in m));
      if (!dates.length) {
        setValidationDateTime({
          ...validationDateTime,
          ranges,
        });
      } else {
        ranges.push({
          DateNotEqual: dates,
        });
        setValidationDateTime({
          ...validationDateTime,
          ranges,
        });
      }
    },
    [setValidationDateTime, validationDateTime]
  );

  const noDate = dateRequire === 'prohibit';

  return (
    <div>
      <Accordion type="single" collapsible className="w-full" defaultValue={equals?.length ? 'date-equals' : undefined}>
        <AccordionItem value="date-equals">
          <AccordionTrigger disabled={noDate} className={noDate ? 'opacity-50' : ''}>
            <div className="flex">Date equals{noDateHelp}</div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <ValidationInput
              placeholder="Enter dates separated by commas"
              disabled={readOnly}
              value={equals ? equals.join(', ') : ''}
              onChange={changeEquals}
              readOnly={readOnly}
              error={equalsError ? 'Please enter valid dates separated by commas' : undefined}
              onEnter={onEnter}
              showOnFocus={
                <ValidationCalendar
                  dates={equals?.map((d) => new Date(d))}
                  setDates={(dates) => {
                    changeEquals(dates);
                    return false;
                  }}
                />
              }
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={notEquals?.length ? 'date-not-equals' : undefined}
        value={equals?.length ? '' : undefined}
      >
        <AccordionItem value="date-not-equals">
          <AccordionTrigger
            className={noDate || equals.length ? 'opacity-50' : ''}
            disabled={noDate || !!equals.length}
          >
            <div className="flex">
              Date does not equal{noDateHelp}
              {equalsSetHelp}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <div className="flex w-full flex-col gap-1">
              <ValidationInput
                placeholder="Enter dates separated by commas"
                disabled={readOnly}
                value={notEquals ? notEquals.join(', ') : ''}
                onChange={changeNotEquals}
                readOnly={readOnly}
                error={notEqualsError ? 'Please enter valid dates separated by commas' : undefined}
                onEnter={onEnter}
                showOnFocus={
                  <ValidationCalendar
                    dates={notEquals?.map((d) => new Date(d))}
                    setDates={(dates) => {
                      changeNotEquals(dates);
                      return false;
                    }}
                  />
                }
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
