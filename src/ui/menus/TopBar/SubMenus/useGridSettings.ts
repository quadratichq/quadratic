import { useCallback } from 'react';
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
  showCellTypeOutlines: true,
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

  // Return fn to derive state from other values
  hideApplicationUI: () => boolean;
  toggleApplicationUI: () => void;
}

export const useGridSettings = (): GridSettingsReturn => {
  const [settings, setSettings] = useLocalStorage('gridSettings', defaultGridSettings);

  const emitGridSettingsEvent = useCallback(() => {
    window.dispatchEvent(new Event('grid-settings'));
  }, []);

  const setShowGridAxes = useCallback(
    (value: boolean) => {
      if (value !== settings.showGridAxes) {
        setSettings({
          ...settings,
          showGridAxes: value,
        });
        emitGridSettingsEvent();
      }
    },
    [settings, setSettings, emitGridSettingsEvent]
  );

  const setShowHeadings = useCallback(
    (value: boolean) => {
      if (value !== settings.showHeadings) {
        setSettings({
          ...settings,
          showHeadings: value,
        });
        emitGridSettingsEvent();
      }
    },
    [settings, setSettings, emitGridSettingsEvent]
  );

  const setShowGridLines = useCallback(
    (value: boolean) => {
      if (value !== settings.showGridLines) {
        setSettings({
          ...settings,
          showGridLines: value,
        });
        emitGridSettingsEvent();
      }
    },
    [settings, setSettings, emitGridSettingsEvent]
  );

  const setShowCellTypeOutlines = useCallback(
    (value: boolean) => {
      if (value !== settings.showCellTypeOutlines) {
        setSettings({
          ...settings,
          showCellTypeOutlines: value,
        });
        emitGridSettingsEvent();
      }
    },
    [settings, setSettings, emitGridSettingsEvent]
  );

  const hideApplicationUI = useCallback(() => {
    return !(settings.showHeadings || settings.showGridAxes || settings.showGridLines || settings.showCellTypeOutlines);
  }, [settings]);

  const toggleApplicationUI = useCallback(() => {
    const isHidden = hideApplicationUI();

    setSettings({
      showGridAxes: isHidden,
      showHeadings: isHidden,
      showGridLines: isHidden,
      showCellTypeOutlines: isHidden,
    });
    emitGridSettingsEvent();
  }, [setSettings, hideApplicationUI, emitGridSettingsEvent]);

  return {
    ...settings,
    setShowGridAxes,
    setShowHeadings,
    setShowGridLines,
    setShowCellTypeOutlines,
    hideApplicationUI,
    toggleApplicationUI,
  };
};
