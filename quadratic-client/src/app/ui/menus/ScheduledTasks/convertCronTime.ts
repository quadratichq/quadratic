import { type ScheduledTaskIntervalType } from '@/app/ui/menus/ScheduledTasks/ScheduledTask/ScheduledTaskInterval';
import CronExpressionParser from 'cron-parser';

export const cronType = (cron: string): ScheduledTaskIntervalType => {
  const cronFields = CronExpressionParser.parse(cron).fields;
  if (!cronFields.hour.isWildcard && !cronFields.minute.isWildcard) return 'days';
  if (!cronFields.minute.isWildcard && cronFields.hour.isWildcard) return 'hour';
  if (!cronFields.minute.isWildcard) return 'minute';

  return 'days';
};

export const cronToDays = (cron: string): number[] => {
  const cronFields = CronExpressionParser.parse(cron).fields;
  if (cronFields.dayOfWeek.isWildcard) return [1, 2, 3, 4, 5, 6, 7];
  return cronFields.dayOfWeek.values;
};

export const cronToTimeDays = (cron: string): string => {
  const cronFields = CronExpressionParser.parse(cron).fields;
  if (cronFields.hour.isWildcard || cronFields.minute.isWildcard) {
    return '00:00';
  }

  const hourUTC = cronFields.hour.values[0];
  const minuteUTC = cronFields.minute.values[0];
  const date = new Date(Date.UTC(0, 0, 0, hourUTC, minuteUTC, 0));
  const hour = date.getHours();
  const minute = date.getMinutes();

  return `${hour < 10 ? `0${hour}` : hour}:${minute < 10 ? `0${minute}` : minute}`;
};

export const cronToMinute = (cron: string): number | undefined => {
  const cronFields = CronExpressionParser.parse(cron).fields;
  if (cronFields.hour.isWildcard) return undefined;

  return cronFields.minute.values[0] ?? undefined;
};
