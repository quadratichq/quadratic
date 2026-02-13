import { atom, getDefaultStore } from 'jotai';

export type UpgradeDialogEventSource =
  | 'fileLimitReached'
  | 'AIMessageCounterBar'
  | 'SelectAIModelMenu'
  | 'AIUsageExceeded'
  | 'DashboardSidebar'
  | 'SettingsDialog'
  | 'periodicSolicitation';

export type UpgradeSuggestion = { type: 'upgrade'; targetPlan: 'PRO' | 'BUSINESS' } | { type: 'enableOverage' } | null;

type UpgradeDialogState =
  | { open: false; eventSource: null; suggestion?: null }
  | { open: true; eventSource: UpgradeDialogEventSource; suggestion?: UpgradeSuggestion };

export const showUpgradeDialogAtom = atom<UpgradeDialogState>({ open: false, eventSource: null });

export const showUpgradeDialog = (eventSource: UpgradeDialogEventSource, suggestion?: UpgradeSuggestion) => {
  getDefaultStore().set(showUpgradeDialogAtom, { open: true, eventSource, suggestion });
};
