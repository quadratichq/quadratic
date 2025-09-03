//! Stores data for the ScheduledTaskInterval component.

import { JoinListWith } from '@/shared/components/JointListWith';
import { cn } from '@/shared/shadcn/utils';
import CronExpressionParser, { CronFieldCollection, type DayOfWeekRange } from 'cron-parser';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

// local time constants
export const MIDNIGHT_LOCAL_HOUR = new Date(0, 0, 0, 0, 0, 0).getUTCHours();
export const MIDNIGHT_LOCAL_MINUTE = new Date(0, 0, 0, 0, 0, 0).getUTCMinutes();

export type ScheduledTaskIntervalType = 'days' | 'hour' | 'minute' | 'custom';

export const getLocalTimeZoneAbbreviation = (): string => {
  return (
    new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? ''
  );
};

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
export const UseCronInterval = (initialCron?: string): CronInterval => {
  const [cron, setCron] = useState(initialCron ?? `${MIDNIGHT_LOCAL_MINUTE} ${MIDNIGHT_LOCAL_HOUR} * * 1-7`);
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
        CronExpressionParser.parse(input);
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
      return `${MIDNIGHT_LOCAL_HOUR < 10 ? `0${MIDNIGHT_LOCAL_HOUR}` : MIDNIGHT_LOCAL_HOUR}:${MIDNIGHT_LOCAL_MINUTE < 10 ? `0${MIDNIGHT_LOCAL_MINUTE}` : MIDNIGHT_LOCAL_MINUTE}`;
    }
    const { hour, minute } = hourMinuteUTCToLocal(fields.hour.values[0], fields.minute.values[0]);
    return `${hour < 10 ? `0${hour}` : hour}:${minute < 10 ? `0${minute}` : minute}`;
  }, [fields]);

  const localMinute = useMemo((): number => {
    if (!fields) return MIDNIGHT_LOCAL_MINUTE;
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

      if (every === 'custom') {
        setCustom(true);
      } else {
        setCustom(false);
      }
    },
    [setCron, setCustom]
  );

  const changeDaysTime = useCallback(
    (time: string) => {
      if (!fields) return;
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
    [cron, fields]
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
      const { minute: convertedMinute } = hourMinuteLocalToUTC(0, Number(minute));
      const newCronFields = CronExpressionParser.parse(`${convertedMinute} * * * *`).fields;
      setCron(newCronFields.stringify());
    },
    [setCron, fields]
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

const DAYS_STRING = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Displays a cron expression in a list entry format in ScheduledTasksList
export const CronToListEntry = ({ className, cron }: { className: string; cron: string }): JSX.Element => {
  const fields = CronExpressionParser.parse(cron).fields;

  // custom
  if (isCustomCron(fields)) {
    return <div className={cn('text-muted-foreground', className)}>{cron}</div>;
  }

  // days
  if (!fields.hour.isWildcard && !fields.minute.isWildcard) {
    let days: JSX.Element;
    if (fields.dayOfWeek.isWildcard || fields.dayOfWeek.values.length >= 7) {
      days = <span>Every day</span>;
    } else if (
      fields.dayOfWeek.values.length === 5 &&
      fields.dayOfWeek.values.every((day) => !isNaN(Number(day)) && Number(day) > 0 && Number(day) < 6)
    ) {
      days = <span>Every weekday</span>;
    } else if (fields.dayOfWeek.values.length === 2 && fields.dayOfWeek.values.every((day) => day === 0 || day === 6)) {
      days = <span>Every weekend</span>;
    } else {
      days = (
        <JoinListWith
          arr={fields.dayOfWeek.values.flatMap((day) => (!isNaN(Number(day)) ? [DAYS_STRING[Number(day)]] : []))}
          conjunction="and"
        />
      );
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
