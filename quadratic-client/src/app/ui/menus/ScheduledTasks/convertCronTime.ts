import {
  DEFAULT_CRON_INTERVAL_TYPE,
  type ScheduledTaskIntervalType,
} from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskInterval';
import CronExpressionParser from 'cron-parser';

export const cronType = (cron?: string): ScheduledTaskIntervalType => {
  if (!cron) return DEFAULT_CRON_INTERVAL_TYPE;
  const cronFields = CronExpressionParser.parse(cron).fields;
  if (!cronFields.hour.isWildcard && !cronFields.minute.isWildcard) return 'days';
  if (!cronFields.minute.isWildcard && cronFields.hour.isWildcard) return 'hour';
  if (!cronFields.minute.isWildcard) return 'minute';

  return DEFAULT_CRON_INTERVAL_TYPE;
};

export const cronToDays = (cron?: string): number[] | undefined => {
  if (!cron) return undefined;
  const cronFields = CronExpressionParser.parse(cron).fields;
  if (cronFields.dayOfWeek.isWildcard) return undefined;
  return cronFields.dayOfWeek.values;
};

export const cronToTimeDays = (cron?: string): string | undefined => {
  if (!cron) return undefined;
  const cronFields = CronExpressionParser.parse(cron).fields;
  if (cronFields.hour.isWildcard || cronFields.minute.isWildcard) {
    return undefined;
  }

  const hour = cronFields.hour.values[0] < 10 ? `0${cronFields.hour.values[0]}` : cronFields.hour.values[0];
  const minute = cronFields.minute.values[0] < 10 ? `0${cronFields.minute.values[0]}` : cronFields.minute.values[0];
  return `${hour}:${minute}`;
};

export const cronToMinute = (cron?: string): number | undefined => {
  if (!cron) return undefined;
  const cronFields = CronExpressionParser.parse(cron).fields;
  if (cronFields.hour.isWildcard) return undefined;

  return cronFields.minute.values[0] ?? undefined;
};
