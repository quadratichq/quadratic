import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useCallback } from 'react';

const MIN_PANEL_WIDTH = 350;

export function useAIAssistantPanelWidth() {
  const [panelWidth, setPanelWidth] = useLocalStorage<number>('aiAssistantPanelWidth', MIN_PANEL_WIDTH);
  const setWidth = useCallback(
    (width: number) => {
      setPanelWidth(Math.max(MIN_PANEL_WIDTH, width));
    },
    [setPanelWidth]
  );
  return { panelWidth, setPanelWidth: setWidth };
}
