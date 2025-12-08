import { getConnectionKind } from '@/app/helpers/codeCellLanguage';
import { content } from '@/app/gridGL/pixiApp/Content';
import type { MentionColumn, MentionItem } from '@/app/ui/components/MentionsTextarea';
import { useGetGridItems } from '@/app/ui/hooks/useGetGridItems';
import { tableNameToRange } from '@/app/ui/menus/GoTo/GoTo';
import { SheetIcon, TableIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';

export interface MentionGroup {
  heading: string;
  items: MentionItem[];
}

/**
 * Get columns for a table by its name and sheet ID
 */
function getTableColumns(name: string, sheetId: string): MentionColumn[] | undefined {
  try {
    const cellsSheet = content.cellsSheets.getById(sheetId);
    if (!cellsSheet) return undefined;

    const table = cellsSheet.tables.getTableFromName(name);
    if (!table?.codeCell.columns) return undefined;

    return table.codeCell.columns.map((col) => ({
      name: col.name,
      display: col.display,
    }));
  } catch (e) {
    console.warn('Error getting table columns', e);
    return undefined;
  }
}

export const useGetMentions = (value: string): MentionGroup[] => {
  const { tablesFiltered, codeTablesFiltered, sheetsFiltered } = useGetGridItems(value);

  const groups: MentionGroup[] = [];

  if (tablesFiltered.length > 0) {
    groups.push({
      heading: 'Tables',
      items: tablesFiltered.map(({ name, sheet_id }) => ({
        id: name,
        label: name,
        value: name,
        description: tableNameToRange(name),
        icon: <TableIcon />,
        columns: getTableColumns(name, sheet_id),
      })),
    });
  }

  if (codeTablesFiltered.length > 0) {
    groups.push({
      heading: 'Code',
      items: codeTablesFiltered.map(({ name, language, sheet_id }) => ({
        id: name,
        label: name,
        value: name,
        description: tableNameToRange(name),
        icon: <LanguageIcon language={getConnectionKind(language)} />,
        columns: getTableColumns(name, sheet_id),
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
