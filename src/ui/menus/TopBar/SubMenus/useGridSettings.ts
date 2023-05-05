import mixpanel from 'mixpanel-browser';
import { atom, useRecoilState, AtomEffect } from 'recoil';
import { debugGridSettings } from '../../../../debugFlags';

const SETTINGS_KEY = 'viewSettings';
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

// Persist the GrdiSettings
const localStorageEffect: AtomEffect<GridSettings> = ({ setSelf, onSet }) => {
  // Initialize from localStorage
  // Note: presentationMode is always off on a fresh page reload
  const savedValue = localStorage.getItem(SETTINGS_KEY);
  if (savedValue != null) {
    const settings = JSON.parse(savedValue);
    const newSettings = { ...settings, presentationMode: false };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    if (debugGridSettings) console.log('[gridSettings] initializing with values from localStorage', newSettings);
    setSelf(newSettings);
    window.dispatchEvent(new Event('grid-settings'));
  }

  onSet((newValue, _, isReset) => {
    if (debugGridSettings) console.log('[gridSettings] setting new value', newValue);
    isReset ? localStorage.removeItem(SETTINGS_KEY) : localStorage.setItem(SETTINGS_KEY, JSON.stringify(newValue));
  });
};

// Emit an event so pixi app can respond and pull latest values from localStorage
const emitGridSettingsChange: AtomEffect<GridSettings> = ({ onSet }) => {
  onSet((newValue) => {
    if (debugGridSettings) console.log('[gridSettings] emitting `grid-settings` event');
    window.dispatchEvent(new Event('grid-settings'));
  });
};

const gridSettingsAtom = atom({
  key: 'gridSettings',
  default: defaultGridSettings,
  effects: [localStorageEffect, emitGridSettingsChange],
});

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
  const [settings, setSettings] = useRecoilState(gridSettingsAtom);

  const setShowGridAxes = (value: boolean) =>
    setSettings((currentState) => {
      if (value !== currentState.showGridAxes) {
        mixpanel.track('[Grid].[Settings].setShowGridAxes', { value });
        return { ...currentState, showGridAxes: value };
      }
      return currentState;
    });

  const setShowHeadings = (value: boolean) =>
    setSettings((currentState) => {
      if (value !== currentState.showHeadings) {
        mixpanel.track('[Grid].[Settings].setShowHeadings', { value });
        return { ...currentState, showHeadings: value };
      }
      return currentState;
    });

  const setShowGridLines = (value: boolean) =>
    setSettings((currentState) => {
      if (value !== currentState.showGridLines) {
        mixpanel.track('[Grid].[Settings].setShowGridLines', { value });
        return { ...currentState, showGridLines: value };
      }
      return currentState;
    });

  const setShowCellTypeOutlines = (value: boolean) =>
    setSettings((currentState) => {
      if (value !== currentState.showCellTypeOutlines) {
        mixpanel.track('[Grid].[Settings].setShowCellTypeOutlines', { value });
        return { ...settings, showCellTypeOutlines: value };
      }
      return currentState;
    });

  const setShowA1Notation = (value: boolean) =>
    setSettings((currentState) => {
      if (value !== currentState.showA1Notation) {
        mixpanel.track('[Grid].[Settings].setShowA1Notation', { value });
        return { ...currentState, showA1Notation: value };
      }
      return currentState;
    });

  const setPresentationMode = (value: boolean) => {
    setSettings((currentState) => {
      if (value !== currentState.presentationMode) {
        mixpanel.track('[Grid].[Settings].setPresentationMode', { value });
        return { ...currentState, presentationMode: value };
      }
      return currentState;
    });
  };

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
