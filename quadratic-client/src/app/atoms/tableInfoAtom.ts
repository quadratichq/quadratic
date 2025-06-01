import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { JsTableInfo } from '@/app/quadratic-core-types';
import { atom } from 'recoil';

export const defaultTableInfo: JsTableInfo[] = [];

export const tableInfoAtom = atom({
  key: 'tableInfoState',
  default: defaultTableInfo,
  effects: [
    ({ setSelf }) => {
      const sync = () => {
        let tableInfo: JsTableInfo[] = [];
        try {
          tableInfo = sheets.getTableInfo();
        } catch (e) {
          console.error('Error getting table info in tableInfoAtom.ts', e);
        }
        tableInfo.sort((a, b) => a.name.localeCompare(b.name));
        setSelf(tableInfo);
      };

      sync();

      events.on('a1ContextUpdated', sync);
      return () => {
        events.off('a1ContextUpdated', sync);
      };
    },
  ],
});
