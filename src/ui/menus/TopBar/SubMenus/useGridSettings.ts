import { useCallback, useEffect } from 'react';
import useLocalStorage from '../../../../hooks/useLocalStorage';

export interface GridSettings {
  showGridAxes: boolean;
  showHeadings: boolean;
  showGridLines: boolean;
  showCellTypeOutlines: boolean;
}

export const defaultGridSettings: GridSettings = {
  showGridAxes: true,
  showHeadings: true,
  showGridLines: true,
  showCellTypeOutlines: false,
};

interface GridSettingsReturn {
  showGridAxes: boolean;
  showHeadings: boolean;
  showGridLines: boolean;
  showCellTypeOutlines: boolean;
  setShowGridAxes: (value: boolean) => void;
  setShowHeadings: (value: boolean) => void;
  setShowGridLines: (value: boolean) => void;
  setShowCellTypeOutlines: (value: boolean) => void;
}

export const useGridSettings = (): GridSettingsReturn => {
  const [settings, setSettings] = useLocalStorage('viewSettings', defaultGridSettings);

  useEffect(() => {
    if (settings) {
      window.dispatchEvent(new Event('grid-settings'));
    }
  }, [settings]);

  const setShowGridAxes = useCallback(
    (value: boolean) => {
      if (value !== settings.showGridAxes) {
        setSettings({
          ...settings,
          showGridAxes: value,
        });
      }
    },
    [settings, setSettings]
  );

  const setShowHeadings = useCallback(
    (value: boolean) => {
      if (value !== settings.showHeadings) {
        setSettings({
          ...settings,
          showHeadings: value,
        });
      }
    },
    [settings, setSettings]
  );

  const setShowGridLines = useCallback(
    (value: boolean) => {
      if (value !== settings.showGridLines) {
        setSettings({
          ...settings,
          showGridLines: value,
        });
      }
    },
    [settings, setSettings]
  );

  const setShowCellTypeOutlines = useCallback(
    (value: boolean) => {
      if (value !== settings.showCellTypeOutlines) {
        setSettings({
          ...settings,
          showCellTypeOutlines: value,
        });
      }
    },
    [settings, setSettings]
  );

  return { ...settings, setShowGridAxes, setShowHeadings, setShowGridLines, setShowCellTypeOutlines };
};
