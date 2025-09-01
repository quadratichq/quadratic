//! This is the interval component for the scheduled task.

import { cronToTimeDays, cronType } from '@/app/ui/menus/ScheduledTasks/convertCronTime';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import type { DayOfWeekRange } from 'cron-parser';
import { CronExpressionParser, CronFieldCollection } from 'cron-parser';
import { useCallback, useMemo } from 'react';

interface Props {
  cron: string;
  setCron: (cron: string | ((current: string) => string)) => void;
}

export type ScheduledTaskIntervalType = 'days' | 'hour' | 'minute';

const EVERY_ENTRY: [ScheduledTaskIntervalType, string][] = [
  ['days', 'Days'],
  ['hour', 'Hourly'],
  ['minute', 'Every minute'],
];
const EVERY: { value: ScheduledTaskIntervalType; label: string }[] = EVERY_ENTRY.map(([value, label]) => ({
  value,
  label,
}));

const DAYS_STRING = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS: { value: string; label: string }[] = DAYS_STRING.map((day, index) => ({
  value: String(index === 6 ? 0 : index + 1),
  label: day,
}));

export const ScheduledTaskInterval = (props: Props) => {
  const { cron, setCron } = props;

  const every = useMemo(() => cronType(cron), [cron]);
  const timeDays = useMemo(() => cronToTimeDays(cron), [cron]);

  const changeTimeDays = useCallback(
    (time: string) => {
      if (!cron || every !== 'days') return;
      const hour = parseInt(time.split(':')[0]);
      const minute = parseInt(time.split(':')[1]);

      if (isNaN(hour) || isNaN(minute)) {
        return;
      }
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return;
      }

      const date = new Date(0, 0, 0, hour, minute, 0);
      const convertedHour = date.getUTCHours();
      const convertedMinute = date.getUTCMinutes();

      // we use any b/c we're checking the range and type above. otherwise it would be an annoying type to define
      const newCronFields = CronFieldCollection.from(CronExpressionParser.parse(cron).fields, {
        hour: [convertedHour as any],
        minute: [convertedMinute as any],
      });
      setCron(newCronFields.stringify(false));
    },
    [cron, every, setCron]
  );

  // what minute during the hour to run
  const localMinute = useMemo(() => {
    if (!cron || every !== 'hour') return 0;
    const minute = CronExpressionParser.parse(cron).fields.minute.values[0];
    const date = new Date(Date.UTC(0, 0, 0, 0, minute, 0));
    return date.getMinutes();
  }, [cron, every]);

  const changeMinute = useCallback(
    (minute?: number) => {
      if (!cron || every !== 'hour') return;
      if (minute === undefined) return;

      const date = new Date(0, 0, 0, 0, minute, 0);
      const convertedMinute = date.getUTCMinutes();

      const newCronFields = CronExpressionParser.parse(`${convertedMinute} * * * *`).fields;
      setCron(newCronFields.stringify(false));
    },
    [cron, every, setCron]
  );

  const onChangeEvery = useCallback(
    (every: string) => {
      if (every === 'days') {
        const date = new Date(0, 0, 0, 0, 0, 0);
        setCron(`${date.getUTCHours()} ${date.getUTCMinutes()} * * 1-7`);
      } else if (every === 'hour') {
        const date = new Date(0, 0, 0, 0, 0, 0);
        setCron(`${date.getUTCHours()} * * * *`);
      } else if (every === 'minute') {
        setCron('* * * * *');
      }
    },
    [setCron]
  );

  const days = useMemo(() => {
    if (!cron || every !== 'days') return null;
    const daysParsed = CronExpressionParser.parse(cron).fields.dayOfWeek;
    if (daysParsed.isWildcard) return [0, 1, 2, 3, 4, 5, 6];
    const days = daysParsed.values;
    if (days.length === 0) return [0, 1, 2, 3, 4, 5, 6];
    return days;
  }, [cron, every]);

  const changeDays = useCallback(
    (day: string) => {
      setCron((prevCron) => {
        if (!prevCron) return prevCron;

        const value = parseInt(day) as DayOfWeekRange;
        const fields = CronExpressionParser.parse(prevCron).fields;
        const newValues = fields.dayOfWeek.values.includes(value)
          ? [...fields.dayOfWeek.values.filter((v) => v !== value)]
          : [...fields.dayOfWeek.values.filter((v) => v !== value), value];

        // can't have 0 days
        if (newValues.length === 0) return prevCron;
        const newFields = CronFieldCollection.from(fields, {
          dayOfWeek: newValues,
        });
        return newFields.stringify(false);
      });
    },
    [setCron]
  );

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
            <div>Day{days && days.length === 1 ? '' : 's'}</div>
            <div>
              <Button
                className="h-fit py-0 text-gray-500"
                size="sm"
                variant="link"
                disabled={days?.length === 1}
                onClick={() => setCron('0 0 * * 1-7')}
              >
                all
              </Button>
              <Button
                className="h-fit py-0 text-gray-500"
                size="sm"
                variant="link"
                onClick={() => setCron('0 0 * * 1')}
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
            <div className="align-center flex items-center gap-1">
              <Input
                type="time"
                id="time-picker"
                step="60"
                value={timeDays}
                onChange={(e) => changeTimeDays(e.target.value)}
                className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              />
              <div className="text-sm text-gray-500">
                {
                  new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
                    .formatToParts(new Date())
                    .find((part) => part.type === 'timeZoneName')?.value
                }
              </div>
            </div>
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
              value={localMinute ?? ''}
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
