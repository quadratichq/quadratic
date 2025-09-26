import { tableInfoAtom } from '@/app/atoms/tableInfoAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { SheetIcon, TableIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import type { MentionItem } from '@/shared/shadcn/ui/mentions-textarea';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export interface MentionGroup {
  heading: string;
  items: MentionItem[];
}

export const useGetMentions = (value: string): MentionGroup[] => {
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

  const groups: MentionGroup[] = [];

  if (tablesFiltered.length > 0) {
    groups.push({
      heading: 'Tables',
      items: tablesFiltered.map(({ name }) => ({
        id: name,
        label: name,
        value: name,
        description: tableNameToRange(name),
        icon: <TableIcon />,
      })),
    });
  }

  if (codeTablesFiltered.length > 0) {
    groups.push({
      heading: 'Code',
      items: codeTablesFiltered.map(({ name, language }) => ({
        id: name,
        label: name,
        value: name,
        description: tableNameToRange(name),
        icon: <LanguageIcon language={getConnectionKind(language)} />,
      })),
    });
  }

  if (sheetsFiltered.length > 0) {
    groups.push({
      heading: 'Sheets',
      items: sheetsFiltered.map((sheet) => ({
        id: sheet.id,
        label: sheet.name,
        value: sheet.name,
        icon: <SheetIcon />,
      })),
    });
  }

  return groups;
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
