// cursor is at start
export const isCursorAtStart = (): boolean => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount > 1 || selection.type !== 'Caret') return false;
  return selection.anchorOffset === 0;
};

// cursor is at end
export const isCursorAtEnd = (editableDiv: HTMLDivElement): boolean => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount > 1 || selection.type !== 'Caret') return false;
  return selection.anchorOffset === editableDiv.textContent?.length;
};

export const getCursorLocation = (): number => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount > 1 || selection.type !== 'Caret') return 0;
  return selection.anchorOffset;
};
