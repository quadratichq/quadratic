import { DateTimeRange } from '@/app/quadratic-core-types';
import { numberToTime, userTimeToNumber } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { ValidationDateTimeData } from '@/app/ui/menus/Validations/Validation/ValidationDateTime/useValidationDateTime';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/shadcn/ui/accordion';
import { useCallback, useMemo, useState } from 'react';

interface Props {
  dateTimeData: ValidationDateTimeData;
  onEnter: () => void;
}

export const ValidationsTimeEquals = (props: Props) => {
  const { onEnter, dateTimeData } = props;
  const {
    readOnly,
    validationDateTime,
    setValidationDateTime,
    timeEquals,
    timeRequire,
    noTimeHelp,
    timeEqualsSetHelp,
  } = dateTimeData;

  const [equalsError, setEqualsError] = useState(false);
  const [notEqualsError, setNotEqualsError] = useState(false);

  const timeStringToNumber = (time: string): number[] | undefined => {
    const split = time.split(',');
    const times: number[] = [];
    for (const v of split) {
      if (v.trim()) {
        const parsed = userTimeToNumber(v.trim());
        if (parsed) {
          times.push(parsed);
        } else {
          return;
        }
      }
    }
    return times;
  };

  const changeEquals = useCallback(
    (values: string) => {
      if (values.trim() === '') {
        setValidationDateTime({
          ...validationDateTime,
          ranges: validationDateTime.ranges.filter((m) => !('TimeEqual' in m)),
        });
        setEqualsError(false);
        return;
      }

      const times = timeStringToNumber(values);
      if (!times) {
        setEqualsError(true);
        return;
      }

      setEqualsError(false);

      if (!times.length) {
        setValidationDateTime({
          ...validationDateTime,
          ranges: validationDateTime.ranges.filter((m) => !('TimeEqual' in m)),
        });
      } else {
        // TimeEqual can only exist with other time rules; not with other date rules
        const ranges: DateTimeRange[] = validationDateTime.ranges.filter(
          (m) => 'DateEqual' in m || 'DateNotEqual' in m || 'DateRange' in m
        );
        ranges.push({
          TimeEqual: times,
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
    const notEquals = validationDateTime.ranges.find((r) => 'TimeNotEqual' in r);
    if (notEquals && 'TimeNotEqual' in notEquals) {
      return notEquals.TimeNotEqual.map((d) => numberToTime(d));
    } else {
      return [];
    }
  }, [validationDateTime.ranges]);

  const changeNotEquals = useCallback(
    (values: string) => {
      if (values.trim() === '') {
        setValidationDateTime({
          ...validationDateTime,
          ranges: validationDateTime.ranges.filter((m) => !('TimeNotEqual' in m)),
        });
        setNotEqualsError(false);
        return;
      }

      const dates = timeStringToNumber(values);
      if (!dates) {
        setNotEqualsError(true);
        return;
      }
      setNotEqualsError(false);

      const ranges = validationDateTime.ranges.filter((m) => !('TimeNotEqual' in m));
      if (!dates.length) {
        setValidationDateTime({
          ...validationDateTime,
          ranges,
        });
      } else {
        ranges.push({
          TimeNotEqual: dates,
        });
        setValidationDateTime({
          ...validationDateTime,
          ranges,
        });
      }
    },
    [setValidationDateTime, validationDateTime]
  );

  const noTime = timeRequire === 'prohibit';

  return (
    <div>
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={timeEquals?.length ? 'time-equals' : undefined}
      >
        <AccordionItem value="time-equals">
          <AccordionTrigger disabled={noTime} className={noTime ? 'opacity-50' : ''}>
            <div className="flex">Time equals{noTimeHelp}</div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <ValidationInput
              placeholder="Enter times separated by commas"
              disabled={readOnly}
              value={timeEquals ? timeEquals.join(', ') : ''}
              onChange={changeEquals}
              readOnly={readOnly}
              error={equalsError ? 'Please enter valid times separated by commas' : undefined}
              onEnter={onEnter}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={notEquals?.length ? 'time-not-equals' : undefined}
        value={timeEquals?.length ? '' : undefined}
      >
        <AccordionItem value="time-not-equals">
          <AccordionTrigger
            className={noTime || timeEquals.length ? 'opacity-50' : ''}
            disabled={noTime || !!timeEquals.length}
          >
            <div className="flex">
              Time does not equal{noTimeHelp}
              {timeEqualsSetHelp}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1 pt-1">
            <div className="flex w-full flex-col gap-1">
              <ValidationInput
                placeholder="Enter times separated by commas"
                disabled={readOnly}
                value={notEquals ? notEquals.join(', ') : ''}
                onChange={changeNotEquals}
                readOnly={readOnly}
                error={notEqualsError ? 'Please enter valid times separated by commas' : undefined}
                onEnter={onEnter}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
