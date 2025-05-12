import { apiClient } from '@/shared/api/apiClient';
import { atom, DefaultValue } from 'recoil';

type ConnectionDemoAtom = {
  teamUuid: string;
  hideConnectionDemo: boolean | undefined;
};

const defaultValue: ConnectionDemoAtom = {
  teamUuid: '',
  hideConnectionDemo: undefined,
};

// This value comes initially from the server on both the app- and dashboard-side
// We store it in local state and sync optimistically to the server
// This makes the UI instant, but it also helps because we don't revalidate
// data on the app-side of connections so this wouldn't properly update
// through the data router to both the <Connections> component and the
// <ConnectionsMenu> component
export const clientDataKvHideConnectionDemoAtom = atom<ConnectionDemoAtom>({
  key: 'clientDataKvHideConnectionDemoAtom',
  default: defaultValue,
  effects: [
    ({ onSet }) => {
      onSet(async (newValue, oldValue) => {
        // If the value hasn't changed, don't update on the server
        if (
          newValue instanceof DefaultValue ||
          oldValue instanceof DefaultValue ||
          newValue.hideConnectionDemo === oldValue?.hideConnectionDemo
        ) {
          console.log('no change');
          return;
        }

        console.warn('syncing', {
          clientDataKv: { hideConnectionDemo: newValue.hideConnectionDemo },
        });
        await apiClient.teams.update(newValue.teamUuid, {
          clientDataKv: { hideConnectionDemo: newValue.hideConnectionDemo },
        });
      });
    },
  ],
});
