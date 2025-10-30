import { tableInfoAtom } from '@/app/atoms/tableInfoAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

/**
 * Used by the GoTo menu and @-mentions to get the list of stuff available in the grid
 */
export const useGetGridItems = (value: string) => {
  const tableInfo = useRecoilValue(tableInfoAtom);

  const tablesFiltered = useMemo(
    () =>
      tableInfo
        ? tableInfo.filter(({ name, language }) => {
            if (language !== 'Import') {
              return false;
            }

            return value ? name.toLowerCase().includes(value.toLowerCase()) : true;
          })
        : [],
    [tableInfo, value]
  );

  const codeTablesFiltered = useMemo(
    () =>
      tableInfo
        ? tableInfo.filter(({ name, language }) => {
            if (language === 'Formula' || language === 'Import') {
              return false;
            }
            return value ? name.toLowerCase().includes(value.toLowerCase()) : true;
          })
        : [],
    [tableInfo, value]
  );

  const sheetsFiltered = useMemo(
    () =>
      sheets
        .map((sheet) => sheet)
        .filter((sheet) => (value ? sheet.name.toLowerCase().includes(value.toLowerCase()) : true)),
    [value]
  );

  return {
    tablesFiltered,
    codeTablesFiltered,
    sheetsFiltered,
  };
};
