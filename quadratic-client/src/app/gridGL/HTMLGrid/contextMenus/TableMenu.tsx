import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { ContextMenuItem, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuItem';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/shared/shadcn/ui/dropdown-menu';
import { useMemo } from 'react';

interface Props {
  defaultRename?: boolean;
  codeCell?: JsRenderCodeCell;
  selectedColumn?: number;
}

export const TableMenu = (props: Props) => {
  const { defaultRename, codeCell, selectedColumn } = props;
  const cell = getCodeCell(codeCell?.language);
  const isCodeCell = cell && cell.id !== 'Import';

  const hasHiddenColumns = useMemo(() => {
    console.log('TODO: hasHiddenColumns', codeCell);
    return false;
    // return codeCell?.;
  }, [codeCell]);

  const isImageOrHtmlCell = useMemo(() => {
    if (!codeCell) return false;
    return (
      htmlCellsHandler.isHtmlCell(codeCell.x, codeCell.y) ||
      pixiApp.cellsSheet().cellsImages.isImageCell(codeCell.x, codeCell.y)
    );
  }, [codeCell]);

  if (!codeCell || selectedColumn !== undefined) {
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
      {!isImageOrHtmlCell && <ContextMenuItemAction action={Action.SortTable} />}

      {!isImageOrHtmlCell && hasHiddenColumns && <ContextMenuItemAction action={Action.ShowAllColumns} />}
      {!isImageOrHtmlCell && <DropdownMenuSeparator />}
      {!isImageOrHtmlCell && <ContextMenuItemAction action={Action.ToggleHeaderTable} />}
      {!isImageOrHtmlCell && <ContextMenuItemAction action={Action.ToggleFirstRowAsHeaderTable} />}
      {!isImageOrHtmlCell && <ContextMenuItemAction action={Action.ToggleTableAlternatingColors} />}
      {!isImageOrHtmlCell && <DropdownMenuSeparator />}
      {!isImageOrHtmlCell && isCodeCell && <ContextMenuItemAction action={Action.CodeToDataTable} />}
      {!isImageOrHtmlCell && <ContextMenuItemAction action={Action.FlattenTable} />}
      <ContextMenuItemAction action={Action.DeleteDataTable} />
    </>
  );
};
