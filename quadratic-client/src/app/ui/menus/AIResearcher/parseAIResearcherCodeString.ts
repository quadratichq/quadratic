export const parseCodeString = (codeString: string): { query: string; refCell: string } | null => {
  const match = codeString.match(/AI\("(.+?)", ?(.+?)\)/);
  if (match) {
    const [, query, refCell] = match;
    return { query, refCell };
  }
  return null;
};
