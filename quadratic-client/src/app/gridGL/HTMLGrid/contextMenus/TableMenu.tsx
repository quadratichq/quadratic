import { Action } from '@/app/actions/actions';
import { getColumns } from '@/app/actions/dataTableSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { ContextMenuItem, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuItem';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import type { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { EditIcon } from '@/shared/components/Icons';
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
  const hiddenColumns = useMemo(() => getColumns()?.filter((c) => !c.display), []);

  const hasHiddenColumns = useMemo(() => {
    if (!hiddenColumns) return false;

    return hiddenColumns?.length > 0;
  }, [hiddenColumns]);

  const isImageOrHtmlCell = useMemo(() => {
    if (!codeCell) return false;
    return (
      htmlCellsHandler.isHtmlCell(codeCell.x, codeCell.y) ||
      pixiApp.cellsSheet().cellsImages.isImageCell(codeCell.x, codeCell.y)
    );
  }, [codeCell]);

  const spillError = codeCell?.spill_error;

  if (!codeCell || selectedColumn !== undefined) {
    return null;
  }

  return (
    <>
      {isCodeCell && (
        <>
          <DropdownMenuItem onClick={() => defaultActionSpec[Action.EditTableCode].run()}>
            <ContextMenuItem icon={<EditIcon />} text={`Edit code`} />
          </DropdownMenuItem>
        </>
      )}
      <ContextMenuItemAction action={Action.RenameTable} overrideDefaultOption={defaultRename} />
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.SortTable} />}

      {!isImageOrHtmlCell && hasHiddenColumns && !spillError && (
        <ContextMenuItemAction action={Action.ShowAllColumns} />
      )}
      {!isImageOrHtmlCell && !spillError && <DropdownMenuSeparator />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.ToggleHeaderTable} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.ToggleFirstRowAsHeaderTable} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.ToggleTableAlternatingColors} />}
      {!isImageOrHtmlCell && !spillError && <DropdownMenuSeparator />}
      {!isImageOrHtmlCell && !spillError && isCodeCell && <ContextMenuItemAction action={Action.CodeToDataTable} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.FlattenTable} />}
      {<ContextMenuItemAction action={Action.DeleteDataTable} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.InsertTableColumn} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.RemoveTableColumn} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.InsertTableRow} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.RemoveTableRow} />}
    </>
  );
};
