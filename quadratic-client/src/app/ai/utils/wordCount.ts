/**
 * Counts the number of words in a string.
 * Words are defined as sequences of non-whitespace characters.
 *
 * @param text - The text to count words in
 * @returns The number of words in the text
 */
export const countWords = (text: string): number => {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
};
