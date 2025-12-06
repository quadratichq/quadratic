import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useCallback } from 'react';

const DEFAULT_PANEL_WIDTH_AI_ANALYST = 485;
const MIN_PANEL_WIDTH_ANALYST = 300;
const MAX_PANEL_WIDTH_ANALYST = 700;
export function useAIAnalystPanelWidth() {
  const [panelWidth, setPanelWidth] = useLocalStorage<number>('aiAnalystPanelWidth', DEFAULT_PANEL_WIDTH_AI_ANALYST);
  const setWidth = useCallback(
    (width: number) => {
      setPanelWidth(Math.min(Math.max(MIN_PANEL_WIDTH_ANALYST, width), MAX_PANEL_WIDTH_ANALYST));
    },
    [setPanelWidth]
  );
  return { panelWidth, setPanelWidth: setWidth };
}

const MIN_PANEL_WIDTH_CONNECTION_SCHEMA = 300;
const MAX_PANEL_WIDTH_CONNECTION_SCHEMA = 450;
export function useAIAnalystConnectionSchemaPanelWidth() {
  const [panelWidth, setPanelWidth] = useLocalStorage<number>(
    'aiAnalystConnectionSchemaPanelWidth',
    MIN_PANEL_WIDTH_CONNECTION_SCHEMA
  );
  const setWidth = useCallback(
    (width: number) => {
      setPanelWidth(Math.min(Math.max(MIN_PANEL_WIDTH_CONNECTION_SCHEMA, width), MAX_PANEL_WIDTH_CONNECTION_SCHEMA));
    },
    [setPanelWidth]
  );
  return { panelWidth, setPanelWidth: setWidth };
}
