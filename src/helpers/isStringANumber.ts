// from https://stackoverflow.com/a/58550111
export const isStringANumber = (s: string): boolean => {
  return s.trim() !== '' && !isNaN(s as any as number);
};

export const isStringANumberWithCommas = (s: string): boolean => {
  return isStringANumber(s.replaceAll(',', ''));
};
