import type { PixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';

export const focusGrid = (pixiAppSettings?: PixiAppSettings) => {
  const modalShow =
    pixiAppSettings?.editorInteractionState.showCellTypeMenu ||
    pixiAppSettings?.editorInteractionState.showCommandPalette ||
    pixiAppSettings?.editorInteractionState.showConnectionsMenu ||
    pixiAppSettings?.editorInteractionState.showGoToMenu ||
    pixiAppSettings?.editorInteractionState.showFeedbackMenu ||
    pixiAppSettings?.editorInteractionState.showRenameFileMenu ||
    pixiAppSettings?.editorInteractionState.showShareFileMenu ||
    pixiAppSettings?.editorInteractionState.showSearch ||
    pixiAppSettings?.editorInteractionState.showContextMenu;
  if (modalShow) {
    return;
  }

  // Set focus back to Grid
  const grid = document.querySelector<HTMLCanvasElement>('.pixi_canvas');
  if (grid) {
    grid.focus();
  }
};

export const focusAIAnalyst = () => {
  const textarea = document.querySelector<HTMLTextAreaElement>('[data-ai-analyst-input]');
  if (textarea) {
    textarea.focus();
    return;
  }

  // Element not yet in DOM — poll using rAF with a timeout
  const maxWaitMs = 2000;
  const start = performance.now();

  const poll = () => {
    const el = document.querySelector<HTMLTextAreaElement>('[data-ai-analyst-input]');
    if (el) {
      el.focus();
      return;
    }
    if (performance.now() - start < maxWaitMs) {
      requestAnimationFrame(poll);
    }
  };

  requestAnimationFrame(poll);
};
