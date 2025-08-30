import { cronToTimeDays, cronType } from '@/app/ui/menus/ScheduledTasks/convertCronTime';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import type { DayOfWeekRange } from 'cron-parser';
import { CronExpressionParser, CronFieldCollection } from 'cron-parser';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Props {
  cron: string | undefined;
  setCron: (cron: string) => void;
}

export const DEFAULT_CRON_INTERVAL_TYPE: ScheduledTaskIntervalType = 'days';

export type ScheduledTaskIntervalType = 'days' | 'hour' | 'minute';

const EVERY: { value: ScheduledTaskIntervalType; label: string }[] = [
  {
    value: 'days',
    label: 'Days',
  },
  {
    value: 'hour',
    label: 'Hourly',
  },
  {
    value: 'minute',
    label: 'Every minute',
  },
];

const DAYS: { value: string; label: string }[] = [
  {
    value: '1',
    label: 'Mon',
  },
  {
    value: '2',
    label: 'Tue',
  },
  {
    value: '3',
    label: 'Wed',
  },
  {
    value: '4',
    label: 'Thu',
  },
  {
    value: '5',
    label: 'Fri',
  },
  {
    value: '6',
    label: 'Sat',
  },
  {
    value: '7',
    label: 'Sun',
  },
];

export const ScheduledTaskInterval = (props: Props) => {
  const { cron, setCron } = props;
  console.log(cron, cronType(cron));
  const [every, setEvery] = useState<ScheduledTaskIntervalType>(cronType(cron));

  const [cronFields, setCronFields] = useState<CronFieldCollection | undefined>();

  useEffect(() => {
    if (!cron) {
      setEvery('days');
      setCronFields(CronExpressionParser.parse('0 0 * * 1-7').fields);
      return;
    }
    try {
      const interval = CronExpressionParser.parse(cron);
      setCronFields(interval.fields);
      setEvery(cronType(cron));
    } catch (e) {
      console.error(e);
    }
  }, [cron]);

  const timeDays = useMemo(() => cronToTimeDays(cron), [cron]);

  const changeTimeDays = useCallback(
    (time: string) => {
      if (!cronFields || every !== 'days') return;
      const hour = parseInt(time.split(':')[0]);
      const minute = parseInt(time.split(':')[1]);

      if (isNaN(hour) || isNaN(minute)) {
        return;
      }
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return;
      }

      // we use any b/c we're checking the range and type above. otherwise it would be an annoying type to define
      const newCronFields = CronFieldCollection.from(cronFields, {
        hour: [hour as any],
        minute: [minute as any],
      });
      setCronFields(newCronFields);
      setCron(newCronFields.stringify(false));
    },
    [cronFields, every, setCron]
  );

  // what minute during the hour to run
  const minute = useMemo(() => {
    if (!cronFields || every !== 'hour') return null;
    return cronFields.minute.values[0] ?? null;
  }, [cronFields, every]);

  const changeMinute = useCallback(
    (minute?: number) => {
      if (!cronFields || every !== 'hour') return;
      if (minute === undefined) return;

      const newCronFields = CronExpressionParser.parse(`${minute} * * * *`).fields;
      setCronFields(newCronFields);
      setCron(newCronFields.stringify(false));
    },
    [cronFields, every, setCron]
  );

  const onChangeEvery = useCallback(
    (every: string) => {
      setEvery(every as ScheduledTaskIntervalType);
      if (every === 'days') {
        const fields = CronExpressionParser.parse('0 0 * * 1-7').fields;
        setCronFields(fields);
        setCron(fields.stringify(false));
      } else if (every === 'hour') {
        const fields = CronExpressionParser.parse('0 * * * *').fields;
        setCronFields(fields);
        setCron(fields.stringify(false));
      } else if (every === 'minute') {
        const fields = CronExpressionParser.parse('* * * * *').fields;
        setCronFields(fields);
        setCron(fields.stringify(false));
      }
    },
    [setCron, setCronFields, setEvery]
  );

  const days = useMemo(() => {
    if (!cronFields || every !== 'days') return null;
    return cronFields.dayOfWeek.values;
  }, [cronFields, every]);

  const changeDays = useCallback(
    (day: string) => {
      setCronFields((prevFields) => {
        if (!prevFields) return prevFields;

        const value = parseInt(day) as DayOfWeekRange;
        const newValues = day
          ? [...prevFields.dayOfWeek.values.filter((v) => v !== value), value]
          : prevFields.dayOfWeek.values.filter((v) => v !== value);

        // can't have 0 days
        if (newValues.length === 0) return prevFields;
        const newFields = CronFieldCollection.from(prevFields, {
          dayOfWeek: newValues,
        });
        setCron(newFields.stringify(false));
        setCronFields(newFields);
        return newFields;
      });
    },
    [setCron]
  );

  console.log(cron);

  return (
    <div className="flex flex-col gap-4">
      <ValidationDropdown
        className="flex flex-col gap-1"
        label="Run interval"
        labelClassName="text-xs text-gray-500"
        value={every}
        onChange={onChangeEvery}
        options={EVERY}
      />

      {every === 'days' && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-row justify-between align-bottom text-xs text-gray-500">
            <div>Day{cronFields?.dayOfWeek?.values.length === 1 ? '' : 's'}</div>
            <div>
              <Button
                className="h-fit py-0 text-gray-500"
                size="sm"
                variant="link"
                disabled={
                  cronFields?.dayOfWeek &&
                  (cronFields.dayOfWeek.values.length === 8 ||
                    (cronFields.dayOfWeek.values.length === 1 && cronFields.dayOfWeek.values[0] === 0))
                }
                onClick={() => {
                  setCronFields(CronExpressionParser.parse('0 0 * * 1-7').fields);
                }}
              >
                all
              </Button>
              <Button
                className="h-fit py-0 text-gray-500"
                size="sm"
                variant="link"
                onClick={() => {
                  setCronFields(CronExpressionParser.parse('0 0 * * 1').fields);
                }}
              >
                clear
              </Button>
            </div>
          </div>
          <div className="align-center flex w-full flex-row justify-between gap-1 border p-2">
            {DAYS.map((day) => (
              <Toggle
                key={day.value}
                variant="outline"
                className="w-8 text-xs hover:bg-transparent"
                pressed={days?.includes(parseInt(day.value) as DayOfWeekRange) ?? false}
                onPressedChange={() => changeDays(day.value)}
              >
                {day.label}
              </Toggle>
            ))}
          </div>
        </div>
      )}

      {every === 'days' && (
        <div className="flex flex-row justify-between align-bottom text-xs text-gray-500">
          <div className="flex flex-col gap-1">
            <Label htmlFor="time-picker" className="text-xs text-gray-500">
              Time
            </Label>
            <Input
              type="time"
              id="time-picker"
              step="60"
              value={timeDays}
              onChange={(e) => changeTimeDays(e.target.value)}
              className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </div>
        </div>
      )}

      {every === 'hour' && (
        <div className="flex flex-row justify-between align-bottom text-xs text-gray-500">
          <div className="flex flex-col gap-1">
            <Label htmlFor="minute-picker" className="text-xs text-gray-500">
              Run at minute
            </Label>
            <Input
              type="number"
              id="minute-picker"
              value={minute ?? ''}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (isNaN(val)) {
                  changeMinute();
                  return;
                }
                if (val < 0) {
                  changeMinute(0);
                } else if (val > 59) {
                  changeMinute(59);
                } else {
                  changeMinute(val);
                }
              }}
              className="w-16"
            />
          </div>
        </div>
      )}
    </div>
  );
};
