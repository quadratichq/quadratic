/*
 * Converts a string to a bool.
 *
 * This conversion will:
 *
 *  - match 'true', 'on', or '1' as true.
 *  - ignore all white-space padding
 *  - ignore capitalization (case).
 *
 * '  tRue  ','ON', and '1   ' will all evaluate as true.
 *
 */
export const envVarToBool = (s: string | undefined): boolean => {
  // will match one and only one of the string 'true','1', or 'on' regardless
  // of capitalization and regardless off surrounding white-space.
  //
  if (s === undefined) return false;

  let regex = /^\s*(true|1|on)\s*$/i;

  return regex.test(s);
};
