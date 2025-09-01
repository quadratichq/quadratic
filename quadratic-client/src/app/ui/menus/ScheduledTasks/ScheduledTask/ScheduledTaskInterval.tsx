//! This is the interval component for the scheduled task.

import {
  getLocalTimeZoneAbbreviation,
  type CronResults,
  type ScheduledTaskIntervalType,
} from '@/app/ui/menus/ScheduledTasks/CronTime';
import { ValidationDropdown } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import type { DayOfWeekRange } from 'cron-parser';

const EVERY_ENTRY: [ScheduledTaskIntervalType, string][] = [
  ['days', 'On days'],
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

export const ScheduledTaskInterval = (props: { cronResults: CronResults }) => {
  const {
    cronType,
    days,
    localTimeString,
    localMinute,

    changeInterval,
    changeDaysTime,
    changeDaysDay,
    changeDaysAll,
    changeDaysClear,
    changeHoursMinute,
  } = props.cronResults;

  return (
    <div className="flex flex-col gap-4">
      <ValidationDropdown
        className="flex flex-col gap-1"
        label="Run interval"
        labelClassName="text-xs text-gray-500"
        value={cronType}
        onChange={changeInterval}
        options={EVERY}
      />

      {cronType === 'days' && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-row justify-between align-bottom text-xs text-gray-500">
            <div>Day{days && days.length === 1 ? '' : 's'}</div>
            <div>
              <Button
                className="h-fit py-0 text-gray-500"
                size="sm"
                variant="link"
                disabled={days.length >= 7}
                onClick={() => changeDaysAll()}
              >
                all
              </Button>
              <Button
                className="h-fit py-0 text-gray-500"
                size="sm"
                variant="link"
                disabled={days.length === 1}
                onClick={() => changeDaysClear()}
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
                onPressedChange={() => changeDaysDay(day.value)}
              >
                {day.label}
              </Toggle>
            ))}
          </div>
        </div>
      )}

      {cronType === 'days' && (
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
                value={localTimeString}
                onChange={(e) => changeDaysTime(e.target.value)}
                className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              />
              <div className="text-sm text-gray-500">{getLocalTimeZoneAbbreviation()}</div>
            </div>
          </div>
        </div>
      )}

      {cronType === 'hour' && (
        <div className="flex flex-row justify-between align-bottom text-xs text-gray-500">
          <div className="flex flex-col gap-1">
            <Label htmlFor="minute-picker" className="text-xs text-gray-500">
              Run at minute
            </Label>
            <Input
              type="number"
              min={0}
              max={59}
              id="minute-picker"
              defaultValue={localMinute ?? ''}
              onBlur={(e) => changeHoursMinute(e.target.value)}
              className="w-16"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  changeHoursMinute(e.currentTarget.value);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
