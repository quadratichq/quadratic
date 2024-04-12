export const pluralize = (s: string, count: number): string => {
  if (count > 1) {
    return `${s}s`;
  } else {
    return s;
  }
};
