import { debugGridSettings } from '@/app/debugFlags';
import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import { AtomEffect, DefaultValue, atom, selector } from 'recoil';

const SETTINGS_KEY = 'viewSettings';

export type GridSettings = {
  showGridAxes: boolean;
  showHeadings: boolean;
  showGridLines: boolean;
  showCellTypeOutlines: boolean;
  showA1Notation: boolean;
  showCodePeek: boolean;
  presentationMode: boolean;
};

export const defaultGridSettings: GridSettings = {
  showGridAxes: true,
  showHeadings: true,
  showGridLines: true,
  showCellTypeOutlines: true,
  showA1Notation: false,
  showCodePeek: false,
  presentationMode: false,
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
    if (debugGridSettings) console.log('[gridSettings] initializing with values from localStorage', newSettings);
    setSelf(newSettings);
    events.emit('gridSettings');
  }

  onSet((newValue, _, isReset) => {
    if (debugGridSettings) console.log('[gridSettings] setting new value', newValue);
    isReset ? localStorage.removeItem(SETTINGS_KEY) : localStorage.setItem(SETTINGS_KEY, JSON.stringify(newValue));
  });
};

// Emit an event so pixi app can respond and pull latest values from localStorage
const emitGridSettingsChange: AtomEffect<GridSettings> = ({ onSet }) => {
  onSet(() => {
    if (debugGridSettings) console.log('[gridSettings] emitting `grid-settings` event');
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

export const showGridAxesAtom = createSelector('showGridAxes');
export const showHeadingsAtom = createSelector('showHeadings');
export const showGridLinesAtom = createSelector('showGridLines');
export const showCellTypeOutlinesAtom = createSelector('showCellTypeOutlines');
export const showA1NotationAtom = createSelector('showA1Notation');
export const showCodePeekAtom = createSelector('showCodePeek');
export const presentationModeAtom = createSelector('presentationMode');