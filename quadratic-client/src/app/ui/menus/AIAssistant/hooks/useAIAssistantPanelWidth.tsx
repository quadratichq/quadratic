import { MIN_WIDTH_VISIBLE_GRID } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useCallback } from 'react';

const MIN_PANEL_WIDTH = 350;

export function useAIResearcherPanelWidth() {
  const [panelWidth, setPanelWidth] = useLocalStorage<number>('aiResearcherPanelWidth', MIN_PANEL_WIDTH);
  const setWidth = useCallback(
    (width: number) => {
      const max = window.innerWidth - MIN_WIDTH_VISIBLE_GRID;
      width = Math.max(MIN_PANEL_WIDTH, Math.min(max, width));
      setPanelWidth(width);
    },
    [setPanelWidth]
  );
  return { panelWidth, setPanelWidth: setWidth };
}
