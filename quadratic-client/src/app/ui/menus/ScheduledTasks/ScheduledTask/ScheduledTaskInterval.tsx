//! This is the interval component for the scheduled task.

import { debugFlag } from '@/app/debugFlags/debugFlags';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { ScheduledTaskInputGroup } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskInputGroup';
import {
  getTimeZoneAbbreviation,
  type CronInterval,
  type ScheduledTaskIntervalType,
} from '@/app/ui/menus/ScheduledTasks/useCronInterval';
import { DOCUMENTATION_CRON } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import { cn } from '@/shared/shadcn/utils';

const EVERY_ENTRY: [ScheduledTaskIntervalType, string][] = [
  ...(debugFlag('debug') ? [['minute', 'Every minute'] as [ScheduledTaskIntervalType, string]] : []),
  ['hour', 'Every hour'],
  ['days', 'Every day'],
  ['custom', 'Custom cron'],
];

const EVERY: { value: ScheduledTaskIntervalType; label: string }[] = EVERY_ENTRY.map(([value, label]) => ({
  value,
  label,
}));

const DAYS_STRING = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'];
const DAYS: { value: string; label: string }[] = DAYS_STRING.map((day, index) => ({
  value: String(index === 6 ? 0 : index + 1),
  label: day,
}));

interface Props {
  cronInterval: CronInterval;
}

export const ScheduledTaskInterval = (props: Props) => {
  const { timezone: fileTimezone } = useFileContext();

  // Use file timezone or fallback to browser timezone
  const timezone = fileTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneAbbr = getTimeZoneAbbreviation(timezone);

  const {
    cronType,
    days,
    localTimeString,
    localMinute,
    customCron,
    cronError,

    changeInterval,
    changeDaysTime,
    changeDaysDay,
    changeDaysAll,
    changeDaysClear,
    changeDaysWeekdays,
    changeHoursMinute,
    changeCustomCron,
  } = props.cronInterval;

  return (
    <div className="mt-2 flex flex-col gap-4">
      <ScheduledTaskInputGroup>
        <Label htmlFor="run-interval" className="mt-3">
          Interval
        </Label>
        <div className="flex flex-col gap-2">
          <Select value={cronType} onValueChange={changeInterval}>
            <SelectTrigger id="run-interval" className="select-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVERY.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cronType === 'days' && (
            <>
              <div className="flex flex-col gap-1 rounded-md border border-border p-0.5 shadow-sm">
                <div className="align-center grid grid-cols-7 flex-row gap-0.5 rounded p-0.5">
                  {DAYS.map((day) => (
                    <Toggle
                      key={day.value}
                      variant="outline"
                      className="border-none text-xs shadow-none data-[state=on]:bg-accent data-[state=off]:text-muted-foreground"
                      pressed={days?.includes(Number(day.value)) ?? false}
                      onPressedChange={() => changeDaysDay(day.value)}
                    >
                      {day.label}
                    </Toggle>
                  ))}
                </div>

                <div className="mb-1 flex flex-row justify-start align-bottom text-xs">
                  <Button
                    className="h-fit py-0 text-muted-foreground"
                    size="sm"
                    variant="link"
                    disabled={days.length >= 7}
                    onClick={() => changeDaysAll()}
                  >
                    All
                  </Button>
                  <Button
                    className="h-fit py-0 text-muted-foreground"
                    size="sm"
                    variant="link"
                    onClick={() => changeDaysWeekdays()}
                  >
                    Weekdays
                  </Button>
                  <Button
                    className="ml-auto h-fit py-0 text-muted-foreground"
                    size="sm"
                    variant="link"
                    disabled={days.length === 1}
                    onClick={() => changeDaysClear()}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="align-center flex items-center gap-3">
                at
                <Input
                  type="time"
                  id="time-picker"
                  step="60"
                  value={localTimeString}
                  onChange={(e) => changeDaysTime(e.target.value)}
                  onKeyDown={(e) => {
                    // Stop propagation to prevent grid shortcuts from interfering,
                    // but allow Escape to bubble up to close the panel
                    if (e.key !== 'Escape') {
                      e.stopPropagation();
                    }
                  }}
                  className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
                <div className="text-sm">{timezoneAbbr}</div>
              </div>
            </>
          )}
          {cronType === 'hour' && (
            <div className="align-center flex flex-row items-center gap-3">
              at
              <Input
                type="number"
                min={0}
                max={59}
                id="minute-picker"
                defaultValue={localMinute ?? ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (e.target.value !== '' && (isNaN(value) || value < 0 || value > 59)) {
                    e.target.value = String(Math.max(0, Math.min(59, value || 0)));
                  }
                }}
                onBlur={(e) => changeHoursMinute(e.target.value)}
                className=""
                onKeyDown={(e) => {
                  // Stop propagation to prevent grid shortcuts from interfering,
                  // but allow Escape to bubble up to close the panel
                  if (e.key !== 'Escape') {
                    e.stopPropagation();
                  }
                  if (e.key === 'Enter') {
                    changeHoursMinute(e.currentTarget.value);
                  }
                }}
              />
              minutes
              <div className="text-sm">{timezoneAbbr}</div>
            </div>
          )}
          {cronType === 'custom' && (
            <div className="align-center flex flex-col gap-1">
              <Input
                type="text"
                id="custom-cron"
                value={customCron}
                onChange={(e) => changeCustomCron(e.target.value)}
                onKeyDown={(e) => {
                  // Stop propagation to prevent grid shortcuts from interfering,
                  // but allow Escape to bubble up to close the panel
                  if (e.key !== 'Escape') {
                    e.stopPropagation();
                  }
                }}
                className={cn(cronError && 'border-destructive')}
              />
              {cronError && <p className="text-xs text-destructive">{cronError}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                All cron times in GMT. See the{' '}
                <a href={DOCUMENTATION_CRON} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                  documentation
                </a>{' '}
                for more information about cron expressions.
              </p>
            </div>
          )}
        </div>
      </ScheduledTaskInputGroup>
    </div>
  );
};
