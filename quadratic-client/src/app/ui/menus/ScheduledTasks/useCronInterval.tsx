//! Stores data for the ScheduledTaskInterval component.

import { debugFlag } from '@/app/debugFlags/debugFlags';
import { joinListWith } from '@/shared/components/JointListWith';
import CronExpressionParser, { CronFieldCollection, type DayOfWeekRange } from 'cron-parser';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type ScheduledTaskIntervalType = 'days' | 'hour' | 'minute' | 'custom';

const CRON_ERROR_TOO_FREQUENT = 'cannot run more frequently than once per hour';
const CRON_MIN_INTERVAL_MS = 1000 * 60 * 60;

export const getTimeZoneAbbreviation = (timezone: string): string => {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? ''
  );
};

const isDebug = debugFlag('debug');

export interface CronInterval {
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
  changeCustomCron: (cron: string) => void;

  customCron: string;
  cronError: string | undefined;
}

const hourMinuteUTCToTimezone = (hour: number, minute: number, timezone: string): { hour: number; minute: number } => {
  // Create a UTC date
  const utcDate = new Date(Date.UTC(2000, 0, 1, hour, minute, 0));

  // Format in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const hourInTz = parseInt(parts.find((p) => p.type === 'hour')?.value || '0');
  const minuteInTz = parseInt(parts.find((p) => p.type === 'minute')?.value || '0');

  return { hour: hourInTz, minute: minuteInTz };
};

const hourMinuteTimezoneToUTC = (hour: number, minute: number, timezone: string): { hour: number; minute: number } => {
  // Create a date representing midnight on Jan 1, 2000 in UTC
  // We'll use this as a reference point to calculate the offset
  const utcDate = new Date(Date.UTC(2000, 0, 1, hour, minute, 0));

  // Convert this UTC date to the target timezone and back to get the offset
  const tzDate = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
  const offset = utcDate.getTime() - tzDate.getTime();

  // Apply the offset to convert from target timezone to UTC
  const correctedDate = new Date(utcDate.getTime() + offset);

  return { hour: correctedDate.getUTCHours(), minute: correctedDate.getUTCMinutes() };
};

// Helper to get midnight in a timezone converted to UTC
const getMidnightInTimezoneAsUTC = (timezone: string): { hour: number; minute: number } => {
  return hourMinuteTimezoneToUTC(0, 0, timezone);
};

const isCustomCron = (fields: CronFieldCollection): boolean => {
  return (
    !fields.dayOfMonth.isWildcard ||
    !fields.month.isWildcard ||
    (fields.hour.values.length !== 1 && !fields.hour.isWildcard) ||
    (fields.minute.values.length !== 1 && !fields.minute.isWildcard) ||
    fields.second.values.length !== 1 ||
    fields.second.values[0] !== 0
  );
};

// Provides setting and displaying cron expressions for ScheduledTask
export const UseCronInterval = (initialCron?: string, timezone?: string): CronInterval => {
  // Use provided timezone or fallback to browser timezone (memoized to react to changes)
  const tz = useMemo(() => timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, [timezone]);

  const { hour: midnightHour, minute: midnightMinute } = useMemo(() => getMidnightInTimezoneAsUTC(tz), [tz]);

  // Calculate initial cron value - only runs once on mount
  const initialCronValue = useMemo(() => {
    if (initialCron) return initialCron;
    const { hour, minute } = getMidnightInTimezoneAsUTC(tz);
    return `${minute} ${hour} * * 1-7`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const [cron, setCron] = useState(initialCronValue);
  const [custom, setCustom] = useState(false);

  const [cronError, setCronError] = useState<string | undefined>();

  const fields = useMemo(() => {
    if (!custom) {
      return CronExpressionParser.parse(cron).fields;
    }
  }, [cron, custom]);

  const cronType = useMemo(() => {
    if (custom || !fields) return 'custom';
    if (isCustomCron(fields)) {
      setCustom(true);
      return 'custom';
    }
    if (!fields.hour.isWildcard && !fields.minute.isWildcard) return 'days';
    if (!fields.minute.isWildcard && fields.hour.isWildcard) return 'hour';
    return 'minute';
  }, [custom, fields]);

  // used to track changes to custom cron expression
  const [customCron, _setCustomCron] = useState<string>(cron ?? '');
  useEffect(() => {
    // keep customCron in sync with cron when not in custom mode
    if (cronType !== 'custom') {
      _setCustomCron(cron);
    }
  }, [cronType, cron, _setCustomCron]);

  const changeCustomCron = useCallback(
    (input: string) => {
      _setCustomCron(input);
      try {
        // ensure the cron expression is valid before updating the actual cron expression
        const parsed = CronExpressionParser.parse(input);

        // In production, check if cron runs more frequently than once per hour
        if (!isDebug) {
          const interval1 = parsed.next();
          const interval2 = parsed.next();
          const diffMs = interval2.getTime() - interval1.getTime();
          const diffHours = diffMs / CRON_MIN_INTERVAL_MS;

          if (diffHours < 1) {
            setCronError(CRON_ERROR_TOO_FREQUENT);
            return;
          }
        }

        setCronError(undefined);
        setCron(input);
      } catch (e: any) {
        setCronError(e.message);
      }
    },
    [_setCustomCron]
  );

  const days = useMemo((): number[] => {
    if (!fields) return [];
    if (fields.dayOfWeek.isWildcard) return [0, 1, 2, 3, 4, 5, 6];
    return fields.dayOfWeek.values as number[];
  }, [fields]);

  const localTimeString = useMemo((): string => {
    if (!fields) return '';
    if (fields.hour.isWildcard || fields.minute.isWildcard) {
      return `${midnightHour < 10 ? `0${midnightHour}` : midnightHour}:${midnightMinute < 10 ? `0${midnightMinute}` : midnightMinute}`;
    }
    const { hour, minute } = hourMinuteUTCToTimezone(fields.hour.values[0], fields.minute.values[0], tz);
    return `${hour < 10 ? `0${hour}` : hour}:${minute < 10 ? `0${minute}` : minute}`;
  }, [fields, tz, midnightHour, midnightMinute]);

  const localMinute = useMemo((): number => {
    if (!fields) return midnightMinute;
    if (fields.minute.isWildcard) return midnightMinute;
    const { minute } = hourMinuteUTCToTimezone(0, fields.minute.values[0], tz);
    return minute;
  }, [fields, tz, midnightMinute]);

  const changeInterval = useCallback(
    (every: string) => {
      if (!isDebug && every === 'minute') {
        setCronError(CRON_ERROR_TOO_FREQUENT);
        return;
      }

      if (every === 'days') {
        const { hour: convertedHour, minute: convertedMinute } = hourMinuteTimezoneToUTC(0, 0, tz);
        setCron(`${convertedMinute} ${convertedHour} * * 1-7`);
      } else if (every === 'hour') {
        const { minute: convertedMinute } = hourMinuteTimezoneToUTC(0, 0, tz);
        setCron(`${convertedMinute} * * * *`);
      } else if (every === 'minute') {
        setCron('* * * * *');
      }

      if (every === 'custom') {
        setCustom(true);
      } else {
        setCustom(false);
      }
    },
    [setCron, setCustom, tz]
  );

  const changeDaysTime = useCallback(
    (time: string) => {
      if (!fields) return;
      const hour = parseInt(time.split(':')[0]);
      const minute = parseInt(time.split(':')[1]);

      // while editing, we may have invalid values, so we just return
      if (isNaN(hour) || isNaN(minute)) return;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return;

      const { hour: convertedHour, minute: convertedMinute } = hourMinuteTimezoneToUTC(hour, minute, tz);

      // we use any b/c we're checking the range and type above. otherwise it would be an annoying type to define
      const newCronFields = CronFieldCollection.from(CronExpressionParser.parse(cron).fields, {
        hour: [convertedHour as any],
        minute: [convertedMinute as any],
      });
      setCron(newCronFields.stringify());
    },
    [cron, fields, tz]
  );

  const changeDaysDay = useCallback(
    (day: string) => {
      if (!fields) return;
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
    [setCron, fields]
  );

  const changeDaysAll = useCallback(() => {
    if (!fields) return;
    setCron(`${fields.minute.values[0]} ${fields.hour.values[0]} * * 1-7`);
  }, [fields]);

  const changeDaysClear = useCallback(() => {
    if (!fields) return;
    setCron(`${fields.minute.values[0]} ${fields.hour.values[0]} * * 1`);
  }, [fields]);

  const changeDaysWeekdays = useCallback(() => {
    if (!fields) return;
    setCron(`${fields.minute.values[0]} ${fields.hour.values[0]} * * 1-5`);
  }, [fields]);

  const changeHoursMinute = useCallback(
    (minute: string) => {
      if (!fields) return;
      if (!minute || isNaN(Number(minute))) return;
      const { minute: convertedMinute } = hourMinuteTimezoneToUTC(0, Number(minute), tz);
      const newCronFields = CronExpressionParser.parse(`${convertedMinute} * * * *`).fields;
      setCron(newCronFields.stringify());
    },
    [setCron, fields, tz]
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
    changeCustomCron,

    customCron,
    cronError,
  };
};

const DAYS_STRING = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

// Displays a cron expression in a list entry format in ScheduledTasksList
export const getCronToListEntry = (cron: string, timezone?: string): string => {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fields = CronExpressionParser.parse(cron).fields;

  // custom
  if (isCustomCron(fields)) {
    return cron;
  }

  // days
  if (!fields.hour.isWildcard && !fields.minute.isWildcard) {
    let days: string;
    if (fields.dayOfWeek.isWildcard || fields.dayOfWeek.values.length >= 7) {
      days = 'Every day';
    } else if (
      fields.dayOfWeek.values.length === 5 &&
      fields.dayOfWeek.values.every((day) => !isNaN(Number(day)) && Number(day) > 0 && Number(day) < 6)
    ) {
      days = 'Every weekday';
    } else if (fields.dayOfWeek.values.length === 2 && fields.dayOfWeek.values.every((day) => day === 0 || day === 6)) {
      days = 'Every weekend';
    } else {
      days = joinListWith({
        arr: fields.dayOfWeek.values.flatMap((day) => (!isNaN(Number(day)) ? [DAYS_STRING[Number(day)]] : [])),
        conjunction: 'and',
      });
    }
    const { hour, minute } = hourMinuteUTCToTimezone(fields.hour.values[0], fields.minute.values[0], tz);
    // Format time in the specified timezone
    const hourFormatted = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const localTimeString = `${hourFormatted}:${minute < 10 ? `0${minute}` : minute} ${ampm}`;
    return `${days} at ${localTimeString} ${getTimeZoneAbbreviation(tz)}`;
  }

  // hourly
  if (!fields.minute.isWildcard && fields.hour.isWildcard) {
    const { minute } = hourMinuteUTCToTimezone(0, fields.minute.values[0], tz);
    return `Every hour at :${minute < 10 ? `0${minute}` : minute} ${getTimeZoneAbbreviation(tz)}`;
  }

  // minute
  return 'Every minute';
};
