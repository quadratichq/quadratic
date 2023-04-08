export const isSeriesKey = (key: string, keys: string[]): boolean => {
  return keys.includes(key);
};

export const isSeriesNextKey = (key: string, existingKeys: string[], allKeys: string[]): boolean => {
  const lastKey = existingKeys[existingKeys.length - 1];

  const index = allKeys.indexOf(lastKey);
  if (index === -1) throw new Error('Expected to find key in allKeys');

  // find index of the key
  const indexNextKey = allKeys.indexOf(key);

  return (index + 1) % allKeys.length === indexNextKey;
};

// https://stackoverflow.com/questions/4467539/javascript-modulo-gives-a-negative-result-for-negative-numbers
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export const getSeriesNextKey = (lastKey: string, allKeys: string[], negative: boolean): string => {
  const index = allKeys.indexOf(lastKey);
  if (index === -1) throw new Error("Can't find last key in all keys");

  return allKeys[mod(negative ? index - 1 : index + 1, allKeys.length)];
};

export const textSeries = [
  'abcdefghijklmnopqrstuvwxyz'.split(''),
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ],
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
];
