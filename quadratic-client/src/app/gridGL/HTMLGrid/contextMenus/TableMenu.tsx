import { Action } from '@/app/actions/actions';
import { MenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/contextMenu';
import { MenuDivider } from '@szhsin/react-menu';

export const TableMenu = () => {
  return (
    <>
      <MenuItemAction action={Action.RenameDataTable} />
      <MenuDivider />
      <MenuItemAction action={Action.ToggleHeaderDataTable} />
      <MenuItemAction action={Action.ToggleFirstRowAsHeaderDataTable} />
      <MenuDivider />
      <MenuItemAction action={Action.FlattenDataTable} />
      <MenuItemAction action={Action.DeleteDataTable} />
    </>
  );
};
