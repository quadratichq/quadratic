//! This shows the table context menu.

import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { ContextMenu } from '@/app/gridGL/HTMLGrid/contextMenus/ContextMenuNew';
import { TableMenu } from '@/app/gridGL/HTMLGrid/contextMenus/TableMenu';

export const TableContextMenu = () => {
  return (
    <ContextMenu contextMenuType={ContextMenuType.Table}>
      {({ contextMenu }) => <TableMenu codeCell={contextMenu.table} />}
    </ContextMenu>
  );
};
