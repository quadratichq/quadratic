import { apiClient } from '@/shared/api/apiClient';
import { atom } from 'recoil';

// This value comes initially from the server on both the app- and dashboard-side
// We store it in local state and sync optimistically to the server
// This makes the UI instant, but it also helps because we don't revalidate
// data on the app-side of connections so this wouldn't properly update
// through the data router to both the <Connections> component and the
// <ConnectionsMenu> component
export const clientDataKvHideConnectionDemoAtom = atom<boolean | undefined>({
  key: 'clientDataKvHideConnectionDemoAtom',
  default: undefined,
  effects: [
    ({ onSet }) => {
      onSet(async (newValue, oldValue) => {
        // If the value hasn't changed, don't update on the server
        if (newValue === oldValue) {
          return;
        }

        await apiClient.teams.update('3d981189-1971-4e78-8b5c-c6fa6e6a0a06', {
          clientDataKv: { onboardingBannerDismissed: true },
        });
      });
    },
  ],
});
