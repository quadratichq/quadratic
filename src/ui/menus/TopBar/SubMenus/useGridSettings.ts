import { useCallback, useEffect } from 'react';
import useLocalStorage from '../../../../hooks/useLocalStorage';

export interface GridSettings {
  showGridAxes: boolean;
  showHeadings: boolean;
  showGridLines: boolean;
  showCellTypeOutlines: boolean;
  showA1Notation: boolean;
}

export const defaultGridSettings: GridSettings = {
  showGridAxes: true,
  showHeadings: true,
  showGridLines: true,
  showCellTypeOutlines: true,
  showA1Notation: false,
};

interface GridSettingsReturn {
  showGridAxes: boolean;
  showHeadings: boolean;
  showGridLines: boolean;
  showCellTypeOutlines: boolean;
  showA1Notation: boolean;
  setShowGridAxes: (value: boolean) => void;
  setShowHeadings: (value: boolean) => void;
  setShowGridLines: (value: boolean) => void;
  setShowCellTypeOutlines: (value: boolean) => void;
  setShowA1Notation: (value: boolean) => void;
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

  const setShowA1Notation = useCallback(
    (value: boolean) => {
      if (value !== settings.showA1Notation) {
        setSettings({
          ...settings,
          showA1Notation: value,
        });
      }
    },
    [settings, setSettings]
  );

  return {
    ...settings,
    setShowGridAxes,
    setShowHeadings,
    setShowGridLines,
    setShowCellTypeOutlines,
    setShowA1Notation,
  };
};
