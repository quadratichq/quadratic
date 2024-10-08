import { atom, selector } from 'recoil';

export enum PanMode {
  Disabled = 'DISABLED',
  Enabled = 'ENABLED',
  Dragging = 'DRAGGING',
}
export interface GridPanMode {
  panMode: PanMode;
  mouseIsDown: boolean;
  spaceIsDown: boolean;
}

export const defaultGridPanMode: GridPanMode = {
  panMode: PanMode.Disabled,
  mouseIsDown: false,
  spaceIsDown: false,
};

export const gridPanModeAtom = atom<GridPanMode>({
  key: 'gridPanMode',
  default: defaultGridPanMode,
  effects: [
    ({ setSelf, onSet }) => {
      onSet((newVal) => {
        if (newVal.spaceIsDown && newVal.mouseIsDown) {
          setSelf({ ...newVal, panMode: PanMode.Dragging });
        } else if (newVal.spaceIsDown) {
          setSelf({ ...newVal, panMode: PanMode.Enabled });
        } else if (newVal.panMode !== PanMode.Dragging || !newVal.mouseIsDown) {
          setSelf({ ...newVal, panMode: PanMode.Disabled });
        }
      });
    },
  ],
});

export const gridPanMode = selector<PanMode>({
  key: 'gridPanModeSelector',
  get: ({ get }) => get(gridPanModeAtom).panMode,
});
