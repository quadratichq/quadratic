/**
 * Calculate the width of panels to the right of the code editor (e.g., ScheduledTasks, ValidationPanel).
 * This is determined by measuring the distance from the code editor's right edge to the window's right edge.
 *
 * @param codeEditorRef - Optional ref to the code editor container element. If provided, uses the ref directly.
 *                        If not provided, queries the DOM by element ID (may be subject to timing issues).
 */
export function getRightPanelsWidth(codeEditorRef?: React.RefObject<HTMLDivElement | null>): number {
  const codeEditorElement = codeEditorRef?.current ?? document.getElementById('QuadraticCodeEditorID')?.parentElement;
  const codeEditorRect = codeEditorElement?.getBoundingClientRect();
  return codeEditorRect ? window.innerWidth - codeEditorRect.right : 0;
}
