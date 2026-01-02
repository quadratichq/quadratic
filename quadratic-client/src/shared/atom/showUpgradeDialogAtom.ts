import { atom, getDefaultStore } from 'jotai';

export type UpgradeDialogEventSource =
  | 'fileLimitReached'
  | 'AIMessageCounterBar'
  | 'SelectAIModelMenu'
  | 'AIUsageExceeded'
  | 'DashboardSidebar'
  | 'SettingsDialog'
  | 'periodicSolicitation';

export const showUpgradeDialogAtom = atom<
  { open: false; eventSource: null } | { open: true; eventSource: UpgradeDialogEventSource }
>({ open: false, eventSource: null });

export const showUpgradeDialog = (eventSource: UpgradeDialogEventSource) => {
  getDefaultStore().set(showUpgradeDialogAtom, { open: true, eventSource });
};
