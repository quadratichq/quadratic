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
      <MenuItemAction action={Action.RenameTable} overrideDefaultOption={defaultRename} />
      <MenuItemAction action={Action.SortTable} />
      <MenuDivider />
      <MenuItemAction action={Action.ToggleHeaderTable} />
      <MenuItemAction action={Action.ToggleFirstRowAsHeaderTable} />
      <MenuItemAction action={Action.ToggleTableAlternatingColors} />
      <MenuDivider />
      {isCodeTable && <MenuItemAction action={Action.CodeToDataTable} />}
      <MenuItemAction action={Action.FlattenTable} />
      <MenuItemAction action={Action.DeleteDataTable} />
    </>
  );
};
