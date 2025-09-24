import { tableInfoAtom } from '@/app/atoms/tableInfoAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { SheetIcon, TableIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import type { MentionItem } from '@/shared/shadcn/ui/mentions-textarea';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const useGetMentions = (value: string): MentionItem[] => {
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

  return [
    ...tablesFiltered.map(({ name }) => ({
      id: name,
      label: name,
      value: name,
      description: tableNameToRange(name),
      icon: <TableIcon />,
    })),
    ...codeTablesFiltered.map(({ name, language }) => ({
      id: name,
      label: name,
      value: name,
      description: tableNameToRange(name),
      icon: <LanguageIcon language={getConnectionKind(language)} />,
    })),
    ...sheetsFiltered.map((sheet) => ({
      id: sheet.id,
      label: sheet.name,
      value: sheet.name,
      icon: <SheetIcon />,
    })),
  ];
};

function tableNameToRange(tableName: string) {
  let range = '';
  try {
    range = sheets.convertTableToRange(tableName, sheets.current);
  } catch (e) {
    console.error('Error getting table name range in useGetMentions.tsx', e);
  }
  return range;
}
