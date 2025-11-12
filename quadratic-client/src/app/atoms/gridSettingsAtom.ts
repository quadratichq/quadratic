import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { AtomEffect } from 'recoil';
import { DefaultValue, atom, selector } from 'recoil';
import { showAIAnalystAtom } from './aiAnalystAtom';

const SETTINGS_KEY = 'viewSettings';

export type GridSettings = {
  showHeadings: boolean;
  showGridLines: boolean;
  showCellTypeOutlines: boolean;
  showA1Notation: boolean;
  showCodePeek: boolean;
  presentationMode: boolean;
  showAIAnalystOnStartup: boolean;
  showScrollbars: boolean;
};

export const defaultGridSettings: GridSettings = {
  showHeadings: true,
  showGridLines: true,
  showCellTypeOutlines: true,
  showA1Notation: false,
  showCodePeek: false,
  presentationMode: false,
  showAIAnalystOnStartup: true,
  showScrollbars: true,
};

// Persist the GridSettings
const localStorageEffect: AtomEffect<GridSettings> = ({ setSelf, onSet }) => {
  // Initialize from localStorage
  // Note: presentationMode is always off on a fresh page reload
  const savedValue = localStorage.getItem(SETTINGS_KEY);
  if (savedValue != null) {
    const settings = JSON.parse(savedValue);
    const newSettings = { ...settings, presentationMode: false };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    if (debugFlag('debugGridSettings'))
      console.log('[gridSettings] initializing with values from localStorage', newSettings);
    setSelf(newSettings);
    events.emit('gridSettings');
  }

  onSet((newValue, _, isReset) => {
    if (debugFlag('debugGridSettings')) console.log('[gridSettings] setting new value', newValue);
    isReset ? localStorage.removeItem(SETTINGS_KEY) : localStorage.setItem(SETTINGS_KEY, JSON.stringify(newValue));
  });
};

// Emit an event so pixi app can respond and pull latest values from localStorage
const emitGridSettingsChange: AtomEffect<GridSettings> = ({ onSet }) => {
  onSet(() => {
    if (debugFlag('debugGridSettings')) console.log('[gridSettings] emitting `grid-settings` event');
    events.emit('gridSettings');
  });
};

export const gridSettingsAtom = atom({
  key: 'gridSettings',
  default: defaultGridSettings,
  effects: [localStorageEffect, emitGridSettingsChange],
});

const createSelector = <T extends keyof GridSettings>(key: T) =>
  selector<GridSettings[T]>({
    key: `codeEditor${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(gridSettingsAtom)[key],
    set: ({ set }, newValue) => {
      set(gridSettingsAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      }));
      focusGrid();
    },
  });

export const showHeadingsAtom = createSelector('showHeadings');
export const showGridLinesAtom = createSelector('showGridLines');
export const showCellTypeOutlinesAtom = createSelector('showCellTypeOutlines');
export const showA1NotationAtom = createSelector('showA1Notation');
export const showCodePeekAtom = createSelector('showCodePeek');
export const presentationModeAtom = createSelector('presentationMode');
export const showScrollbarsAtom = createSelector('showScrollbars');

// Custom selector for showAIAnalystOnStartup that also controls the AI panel visibility
export const showAIAnalystOnStartupAtom = selector<boolean>({
  key: 'codeEditorShowAIAnalystOnStartupAtom',
  get: ({ get }) => get(gridSettingsAtom).showAIAnalystOnStartup,
  set: ({ set }, newValue) => {
    // Update the grid settings
    set(gridSettingsAtom, (prev) => ({
      ...prev,
      showAIAnalystOnStartup: newValue instanceof DefaultValue ? prev.showAIAnalystOnStartup : newValue,
    }));

    // Also update the AI panel visibility to match the setting when user toggles it
    if (!(newValue instanceof DefaultValue)) {
      set(showAIAnalystAtom, newValue);
    }

    focusGrid();
  },
});
