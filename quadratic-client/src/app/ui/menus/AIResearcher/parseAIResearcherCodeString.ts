export const parseCodeString = (codeString: string): { prompt: string; refCell: string } | null => {
  const match = codeString.match(/AI\("(.+?)", ?(.+?)\)/);
  if (match) {
    const [, prompt, refCell] = match;
    return { prompt, refCell };
  }
  return null;
};
