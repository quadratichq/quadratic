import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { useGetGridItems } from '@/app/ui/hooks/useGetGridItems';
import { tableNameToRange } from '@/app/ui/menus/GoTo/GoTo';
import { SheetIcon, TableIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import type { MentionItem } from '@/shared/shadcn/ui/mentions-textarea';

export interface MentionGroup {
  heading: string;
  items: MentionItem[];
}

export const useGetMentions = (value: string): MentionGroup[] => {
  const { tablesFiltered, codeTablesFiltered, sheetsFiltered } = useGetGridItems(value);

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
