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
  defaultEdit?: boolean;
  codeCell?: JsRenderCodeCell;
  selectedColumn?: number;
}

export const TableMenu = (props: Props) => {
  const { defaultEdit, codeCell, selectedColumn } = props;
  const cell = useMemo(() => getCodeCell(codeCell?.language), [codeCell?.language]);
  const isCodeCell = useMemo(() => cell && cell.id !== 'Import', [cell]);
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

  const spillError = useMemo(() => codeCell?.spill_error, [codeCell?.spill_error]);

  if (!codeCell || selectedColumn !== undefined) {
    return null;
  }
  console.log(defaultEdit);
  return (
    <>
      {isCodeCell && (
        <>
          <DropdownMenuItem onClick={() => defaultActionSpec[Action.EditTableCode].run()}>
            <ContextMenuItem
              icon={<EditIcon />}
              text={<div className={defaultEdit !== false ? 'font-bold' : ''}>Edit code</div>}
            />
          </DropdownMenuItem>
        </>
      )}
      <ContextMenuItemAction action={Action.RenameTable} />
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.SortTable} />}

      {!isImageOrHtmlCell && hasHiddenColumns && !spillError && (
        <ContextMenuItemAction action={Action.ShowAllColumns} />
      )}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.ToggleFirstRowAsHeaderTable} />}
      {!isImageOrHtmlCell && !spillError && <DropdownMenuSeparator />}
      {!spillError && <ContextMenuItemAction action={Action.ToggleTableUI} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.ToggleTableName} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.ToggleTableColumns} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.ToggleTableAlternatingColors} />}
      {!isImageOrHtmlCell && !spillError && <DropdownMenuSeparator />}
      {!isImageOrHtmlCell && !spillError && isCodeCell && <ContextMenuItemAction action={Action.CodeToDataTable} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.FlattenTable} />}
      {<ContextMenuItemAction action={Action.DeleteDataTable} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.InsertTableColumnLeft} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.InsertTableColumnRight} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.RemoveTableColumn} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.InsertTableRowAbove} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.InsertTableRowBelow} />}
      {!isImageOrHtmlCell && !spillError && <ContextMenuItemAction action={Action.RemoveTableRow} />}
    </>
  );
};
