// Vanilla js time formatter. Adapted from:
// https://blog.webdevsimplified.com/2020-07/relative-time-format/

const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
  style: 'narrow',
});

const DIVISIONS: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, name: 'seconds' },
  { amount: 60, name: 'minutes' },
  { amount: 24, name: 'hours' },
  { amount: 7, name: 'days' },
  { amount: 4.34524, name: 'weeks' },
  { amount: 12, name: 'months' },
  { amount: Number.POSITIVE_INFINITY, name: 'years' },
];

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
