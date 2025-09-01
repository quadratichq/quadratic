//! Utilities to help convert cron expressions to different formats

import { JoinListWith } from '@/shared/components/JointListWith';
import { cn } from '@/shared/shadcn/utils';
import CronExpressionParser, { CronFieldCollection, type DayOfWeekRange } from 'cron-parser';
import { useCallback, useMemo, useState, type JSX } from 'react';

// local time constants
export const MIDNIGHT_LOCAL_HOUR = new Date(0, 0, 0, 0, 0, 0).getUTCHours();
export const MIDNIGHT_LOCAL_MINUTE = new Date(0, 0, 0, 0, 0, 0).getUTCMinutes();

export type ScheduledTaskIntervalType = 'days' | 'hour' | 'minute';

export const getLocalTimeZoneAbbreviation = (): string => {
  return (
    new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? ''
  );
};

export interface CronResults {
  cron: string;
  cronType: ScheduledTaskIntervalType;
  days: number[];
  localTimeString: string;
  localMinute: number;

  changeInterval: (interval: string) => void;
  changeDaysTime: (time: string) => void;
  changeDaysDay: (day: string) => void;
  changeDaysAll: () => void;
  changeDaysClear: () => void;
  changeDaysWeekdays: () => void;
  changeHoursMinute: (minute: string) => void;
}

const hourMinuteUTCToLocal = (hour: number, minute: number): { hour: number; minute: number } => {
  const date = new Date(Date.UTC(0, 0, 0, hour, minute, 0));
  const hourLocal = date.getHours();
  const minuteLocal = date.getMinutes();
  return { hour: hourLocal, minute: minuteLocal };
};

const hourMinuteLocalToUTC = (hour: number, minute: number): { hour: number; minute: number } => {
  const date = new Date(0, 0, 0, hour, minute, 0);
  const hourUTC = date.getUTCHours();
  const minuteUTC = date.getUTCMinutes();
  return { hour: hourUTC, minute: minuteUTC };
};

// Provides setting and displaying cron expressions for ScheduledTask
export const UseCron = (initialCron?: string): CronResults => {
  const [cron, setCron] = useState(initialCron ?? `${MIDNIGHT_LOCAL_MINUTE} ${MIDNIGHT_LOCAL_HOUR} * * 1-7`);

  const fields = useMemo(() => CronExpressionParser.parse(cron).fields, [cron]);

  const cronType = useMemo(() => {
    if (!fields.hour.isWildcard && !fields.minute.isWildcard) return 'days';
    if (!fields.minute.isWildcard && fields.hour.isWildcard) return 'hour';
    return 'minute';
  }, [fields]);

  const days = useMemo((): number[] => {
    if (fields.dayOfWeek.isWildcard) return [0, 1, 2, 3, 4, 5, 6];
    return fields.dayOfWeek.values;
  }, [fields]);

  const localTimeString = useMemo((): string => {
    if (fields.hour.isWildcard || fields.minute.isWildcard) {
      return `${MIDNIGHT_LOCAL_HOUR < 10 ? `0${MIDNIGHT_LOCAL_HOUR}` : MIDNIGHT_LOCAL_HOUR}:${MIDNIGHT_LOCAL_MINUTE < 10 ? `0${MIDNIGHT_LOCAL_MINUTE}` : MIDNIGHT_LOCAL_MINUTE}`;
    }
    const { hour, minute } = hourMinuteUTCToLocal(fields.hour.values[0], fields.minute.values[0]);
    return `${hour < 10 ? `0${hour}` : hour}:${minute < 10 ? `0${minute}` : minute}`;
  }, [fields]);

  const localMinute = useMemo((): number => {
    if (fields.minute.isWildcard) return MIDNIGHT_LOCAL_MINUTE;
    const { minute } = hourMinuteUTCToLocal(0, fields.minute.values[0]);
    return minute;
  }, [fields]);

  const changeInterval = useCallback(
    (every: string) => {
      if (every === 'days') {
        const { hour: convertedHour, minute: convertedMinute } = hourMinuteLocalToUTC(0, 0);
        setCron(`${convertedMinute} ${convertedHour} * * 1-7`);
      } else if (every === 'hour') {
        const { minute: convertedMinute } = hourMinuteLocalToUTC(0, 0);
        setCron(`${convertedMinute} * * * *`);
      } else if (every === 'minute') {
        setCron('* * * * *');
      }
    },
    [setCron]
  );

  const changeDaysTime = useCallback(
    (time: string) => {
      const hour = parseInt(time.split(':')[0]);
      const minute = parseInt(time.split(':')[1]);

      // while editing, we may have invalid values, so we just return
      if (isNaN(hour) || isNaN(minute)) return;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return;

      const { hour: convertedHour, minute: convertedMinute } = hourMinuteLocalToUTC(hour, minute);

      // we use any b/c we're checking the range and type above. otherwise it would be an annoying type to define
      const newCronFields = CronFieldCollection.from(CronExpressionParser.parse(cron).fields, {
        hour: [convertedHour as any],
        minute: [convertedMinute as any],
      });
      setCron(newCronFields.stringify());
    },
    [cron, setCron]
  );

  const changeDaysDay = useCallback(
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
        return newFields.stringify();
      });
    },
    [setCron]
  );

  const changeDaysAll = useCallback(() => {
    setCron(`${fields.minute.values[0]} ${fields.hour.values[0]} * * 1-7`);
  }, [fields.hour.values, fields.minute.values]);

  const changeDaysClear = useCallback(() => {
    setCron(`${fields.minute.values[0]} ${fields.hour.values[0]} * * 1`);
  }, [fields.hour.values, fields.minute.values]);

  const changeDaysWeekdays = useCallback(() => {
    setCron(`${fields.minute.values[0]} ${fields.hour.values[0]} * * 1-5`);
  }, [fields.hour.values, fields.minute.values]);

  const changeHoursMinute = useCallback(
    (minute: string) => {
      if (!minute || isNaN(Number(minute))) return;
      const { minute: convertedMinute } = hourMinuteLocalToUTC(0, Number(minute));
      console.log('changeHoursMinute', minute, convertedMinute);
      const newCronFields = CronExpressionParser.parse(`${convertedMinute} * * * *`).fields;
      setCron(newCronFields.stringify());
    },
    [setCron]
  );

  return {
    cron,
    cronType,
    days,
    localTimeString,
    localMinute,

    changeInterval,
    changeDaysTime,
    changeDaysDay,
    changeDaysAll,
    changeDaysClear,
    changeDaysWeekdays,
    changeHoursMinute,
  };
};

const DAYS_STRING = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Displays a cron expression in a list entry format in ScheduledTasksList
export const CronToListEntry = ({ className, cron }: { className: string; cron: string }): JSX.Element => {
  const fields = CronExpressionParser.parse(cron).fields;

  // days
  if (!fields.hour.isWildcard && !fields.minute.isWildcard) {
    let days: JSX.Element;
    if (fields.dayOfWeek.isWildcard || fields.dayOfWeek.values.length >= 7) {
      days = <span>Every day</span>;
    } else {
      days = <JoinListWith arr={fields.dayOfWeek.values.map((day) => DAYS_STRING[day])} conjunction="and" />;
    }
    const localTime = new Date(Date.UTC(0, 0, 0, fields.hour.values[0], fields.minute.values[0], 0));
    const localTimeString = localTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return (
      <div className={cn('block text-left text-muted-foreground', className)}>
        <div>
          {days} at {localTimeString} {getLocalTimeZoneAbbreviation()}
        </div>
      </div>
    );
  }

  // hourly
  if (!fields.minute.isWildcard && fields.hour.isWildcard) {
    const { minute } = hourMinuteUTCToLocal(0, fields.minute.values[0]);
    return (
      <div className={cn('block text-left text-muted-foreground', className)}>
        Hourly at :{minute < 10 ? `0${minute}` : minute} {getLocalTimeZoneAbbreviation()}
      </div>
    );
  }

  // minute
  return <div className={cn('block text-left text-muted-foreground', className)}>Every minute</div>;
};
