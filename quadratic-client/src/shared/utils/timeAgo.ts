// Vanilla js time formatter. Adapted from:
// https://blog.webdevsimplified.com/2020-07/relative-time-format/

const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
  style: 'narrow',
});

interface Division {
  name: Intl.RelativeTimeFormatUnit;
  amount: number;
  ms: number;
}

const DIVISIONS: Division[] = [
  { amount: 60, name: 'seconds', ms: 1000 },
  { amount: 60, name: 'minutes', ms: 60 * 1000 },
  { amount: 24, name: 'hours', ms: 60 * 60 * 1000 },
  { amount: 7, name: 'days', ms: 24 * 60 * 60 * 1000 },
  { amount: 4.34524, name: 'weeks', ms: 7 * 24 * 60 * 60 * 1000 },
  { amount: 12, name: 'months', ms: 30 * 24 * 60 * 60 * 1000 },
  { amount: Number.POSITIVE_INFINITY, name: 'years', ms: 12 * 30 * 24 * 60 * 60 * 1000 },
];

const SHOW_NOW_AT = 10 * 1000;

export function timeAgo(dateString: string | number, force = false) {
  const date = new Date(dateString);
  const now = new Date();

  // Calculate the duration in seconds
  let duration = (date.getTime() - now.getTime()) / 1000;

  // If the difference is more than 24 hours, return the formatted date
  // (e.g. "Jan 1, 2024")
  if (!force && Math.abs(duration) > 86400) {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // Otherwise, return the relative time
  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
}

export interface TimeAgoAndNextTimeout {
  timeAgo: string;
  nextInterval: number;
}

// this will have to be better handle localization
export const timeAgoAndNextTimeout = (dateString: string | number): TimeAgoAndNextTimeout => {
  const now = Date.now();
  const date = new Date(dateString);

  // Calculate the duration in milliseconds
  let duration = now - date.getTime();

  // If the difference is more than 24 hours, return the formatted date
  if (duration > 86400000) {
    return {
      timeAgo: date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      nextInterval: -1, // No next interval for formatted date
    };
  }

  // Otherwise, return the relative time
  for (const division of DIVISIONS) {
    const current = duration / division.ms;

    if (current < division.amount) {
      // if it's less than a minute, show "< 1m ago"
      if (division.name === 'seconds') {
        if (duration < SHOW_NOW_AT) {
          return {
            timeAgo: 'Now',
            nextInterval: SHOW_NOW_AT - duration,
          };
        }
        return {
          timeAgo: `< ${formatter.format(-1, 'minute')}`,
          nextInterval: division.amount * division.ms - duration + 1, // +1 to ensure we don't show the same time again
        };
      }

      return {
        timeAgo: formatter.format(-Math.round(current), division.name),
        nextInterval: division.ms + 1, // +1 to ensure we don't show the same time again
      };
    }
  }

  // Fallback case (should never reach here due to POSITIVE_INFINITY in DIVISIONS)
  return {
    timeAgo: formatter.format(Math.round(duration), 'years'),
    nextInterval: -1, // No next interval for fallback
  };
};
