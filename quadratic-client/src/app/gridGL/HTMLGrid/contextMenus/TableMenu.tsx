import { Action } from '@/app/actions/actions';
import { MenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/contextMenu';
import { MenuDivider } from '@szhsin/react-menu';

interface Props {
  isCodeTable: boolean;
  defaultRename?: boolean;
}

export const TableMenu = (props: Props) => {
  const { isCodeTable, defaultRename } = props;

  return (
    <>
      <MenuItemAction action={Action.RenameDataTable} overrideDefaultOption={defaultRename} />
      <MenuDivider />
      <MenuItemAction action={Action.ToggleHeaderDataTable} />
      <MenuItemAction action={Action.ToggleFirstRowAsHeaderDataTable} />
      <MenuDivider />
      {isCodeTable && <MenuItemAction action={Action.CodeToDataTable} />}
      <MenuItemAction action={Action.FlattenDataTable} />
      <MenuItemAction action={Action.DeleteDataTable} />
    </>
  );
};
