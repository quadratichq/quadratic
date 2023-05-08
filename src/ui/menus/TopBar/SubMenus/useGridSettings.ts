import { useCallback, useEffect } from 'react';
import useLocalStorage from '../../../../hooks/useLocalStorage';
import mixpanel from 'mixpanel-browser';

export interface GridSettings {
  showGridAxes: boolean;
  showHeadings: boolean;
  showGridLines: boolean;
  showCellTypeOutlines: boolean;
  showA1Notation: boolean;
  presentationMode: boolean;
}

export const defaultGridSettings: GridSettings = {
  showGridAxes: true,
  showHeadings: true,
  showGridLines: true,
  showCellTypeOutlines: true,
  showA1Notation: false,
  presentationMode: false,
};

interface GridSettingsReturn {
  showGridAxes: boolean;
  showHeadings: boolean;
  showGridLines: boolean;
  showCellTypeOutlines: boolean;
  showA1Notation: boolean;
  presentationMode: boolean;
  setShowGridAxes: (value: boolean) => void;
  setShowHeadings: (value: boolean) => void;
  setShowGridLines: (value: boolean) => void;
  setShowCellTypeOutlines: (value: boolean) => void;
  setShowA1Notation: (value: boolean) => void;
  setPresentationMode: (value: boolean) => void;
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
        mixpanel.track('[Grid].[Settings].setShowGridAxes', { value });
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
        mixpanel.track('[Grid].[Settings].setShowHeadings', { value });
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
        mixpanel.track('[Grid].[Settings].setShowGridLines', { value });
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
        mixpanel.track('[Grid].[Settings].setShowCellTypeOutlines', { value });
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
        mixpanel.track('[Grid].[Settings].setShowA1Notation', { value });
        setSettings({
          ...settings,
          showA1Notation: value,
        });
      }
    },
    [settings, setSettings]
  );

  const setPresentationMode = useCallback(
    (value: boolean) => {
      if (value !== settings.presentationMode) {
        mixpanel.track('[Grid].[Settings].setPresentationMode', { value });
        setSettings({
          ...settings,
          presentationMode: value,
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
    setPresentationMode,
  };
};
