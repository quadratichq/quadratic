// Select ASCII printable characters (char codes from 32-127)
const specialChars = [
  '!',
  '"',
  '#',
  '$',
  '%',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  '-',
  '.',
  ':',
  ';',
  '<',
  '>',
  '?',
  '@',
  '[',
  '\\',
  ']',
  '^',
  '_',
  '`',
  '{',
  '|',
  '}',
  '~',
];

export const isAllowedFirstChar = (char: string): boolean => {
  // Don't allow multiple character keys, like `Tab` or `Caps Lock`
  if (char.length !== 1) {
    return false;
  }

  // 0-9
  if (char >= '0' && char <= '9') {
    return true;
  }

  // A-Z (case insensitive)
  const charCaseInsensitive = char.toLowerCase();
  if (charCaseInsensitive >= 'a' && charCaseInsensitive <= 'z') {
    return true;
  }

  // Other special ASCII characters
  if (specialChars.includes(char)) {
    return true;
  }

  return false;
};
