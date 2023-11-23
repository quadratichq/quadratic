// from https://stackoverflow.com/a/58550111
export const isStringANumber = (s: string) => {
  return s.trim() !== '' && !isNaN(s as any as number);
};
