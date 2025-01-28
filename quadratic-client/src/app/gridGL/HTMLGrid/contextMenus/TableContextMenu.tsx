//! This shows the table context menu.

import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { ContextMenuBase } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuBase';
import { TableMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableMenu';

export const TableContextMenu = () => {
  return (
    <ContextMenuBase contextMenuType={ContextMenuType.Table}>
      {({ contextMenu }) => <TableMenu codeCell={contextMenu.table} selectedColumn={contextMenu.selectedColumn} />}
    </ContextMenuBase>
  );
};
