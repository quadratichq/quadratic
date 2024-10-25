import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { ContextMenuItem, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuItem';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';
import { useMemo } from 'react';

interface Props {
  defaultRename?: boolean;
  codeCell?: JsRenderCodeCell;
}

export const TableMenu = (props: Props) => {
  const { defaultRename, codeCell } = props;
  const cell = getCodeCell(codeCell?.language);
  const isCodeCell = cell && cell.id !== 'Import';

  const hasHiddenColumns = useMemo(() => {
    console.log('TODO: hasHiddenColumns', codeCell);
    return false;
    // return codeCell?.;
  }, [codeCell]);

  if (!codeCell) {
    return null;
  }

  return (
    <>
      {isCodeCell && (
        <>
          <DropdownMenuItem onClick={() => defaultActionSpec[Action.EditTableCode].run()}>
            <ContextMenuItem
              icon={<LanguageIcon language={cell.id} sx={{ color: 'inherit', fontSize: '20px' }} />}
              text={`Edit ${cell.label}`}
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <ContextMenuItemAction action={Action.RenameTable} overrideDefaultOption={defaultRename} />
      <ContextMenuItemAction action={Action.SortTable} />

      {hasHiddenColumns && <ContextMenuItemAction action={Action.ShowAllColumns} />}
      <DropdownMenuSeparator />
      <ContextMenuItemAction action={Action.ToggleHeaderTable} />
      <ContextMenuItemAction action={Action.ToggleFirstRowAsHeaderTable} />
      <ContextMenuItemAction action={Action.ToggleTableAlternatingColors} />
      <DropdownMenuSeparator />
      {isCodeCell && <ContextMenuItemAction action={Action.CodeToDataTable} />}
      <ContextMenuItemAction action={Action.FlattenTable} />
      <ContextMenuItemAction action={Action.DeleteDataTable} />
    </>
  );
};
