import { atom } from 'recoil';

type ConnectionsPanelState = {
  showConnectionsPanel: boolean;
  activeConnectionUuid: string | null;
};

export const defaultConnectionsPanelAtom: ConnectionsPanelState = {
  showConnectionsPanel: false,
  activeConnectionUuid: null,
};

export const connectionsPanelAtom = atom<ConnectionsPanelState>({
  key: 'connectionsPanelAtom',
  default: defaultConnectionsPanelAtom,
});
