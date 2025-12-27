import { Action } from '@/app/actions/actions';
import { ContextMenuBase, ContextMenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/Base';

/**
 * Context menu shown when double-clicking on the data area of a code cell output.
 * Provides options to open the code editor or convert to editable data table.
 */
export function GridContextMenuCodeCellOutput() {
  return (
    <ContextMenuBase>
      <ContextMenuItemAction action={Action.EditTableCode} actionArgs={undefined} overrideDefaultOption={false} />
      <ContextMenuItemAction
        action={Action.CodeToDataTable}
        actionArgs={undefined}
        labelOverride={
          <span className="flex flex-col">
            <span>Convert code table to data table</span>
            <span className="text-xs text-muted-foreground">(becomes editable but loses code)</span>
          </span>
        }
      />
    </ContextMenuBase>
  );
}
