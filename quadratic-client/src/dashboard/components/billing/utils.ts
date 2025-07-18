const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const formatToFractionalDollars = (value: number) => {
  const formatted = formatter.format(value);
  // If it ends in .00, trim it
  if (formatted.endsWith('.00')) {
    return formatted.slice(0, -3);
  }
  return formatted;
};

export const formatToWholeDollar = (value: number) => {
  return formatter
    .formatToParts(value)
    .filter(({ type }) => type !== 'decimal' && type !== 'fraction')
    .map(({ value }) => value)
    .join('');
};

// Given a string, return only the digits
export const parseInputForNumber = (value: string) => {
  return value.replace(/[^0-9]/g, '');
};
