import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useCallback } from 'react';

const MIN_PANEL_WIDTH = 350;
const MAX_PANEL_WIDTH = 600;

export function useAIAnalystPanelWidth() {
  const [panelWidth, setPanelWidth] = useLocalStorage<number>('aiAnalystPanelWidth', MIN_PANEL_WIDTH);
  const setWidth = useCallback(
    (width: number) => {
      setPanelWidth(Math.min(Math.max(MIN_PANEL_WIDTH, width), MAX_PANEL_WIDTH));
    },
    [setPanelWidth]
  );
  return { panelWidth, setPanelWidth: setWidth };
}
