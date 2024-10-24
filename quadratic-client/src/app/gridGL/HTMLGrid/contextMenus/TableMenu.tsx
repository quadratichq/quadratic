import { Action } from '@/app/actions/actions';
import { MenuItemAction } from '@/app/gridGL/HTMLGrid/contextMenus/contextMenu';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { MenuDivider, MenuHeader } from '@szhsin/react-menu';
import { useMemo } from 'react';

interface Props {
  defaultRename?: boolean;
  codeCell?: JsRenderCodeCell;
}

export const TableMenu = (props: Props) => {
  const { defaultRename, codeCell } = props;

  const isCodeTable = codeCell?.language === 'Import' ? 'Data' : 'Code';

  const header = useMemo(() => {
    if (!codeCell) {
      return '';
    }
    if (codeCell.language === 'Import') {
      return 'Data Table';
    } else if (codeCell.language === 'Formula') {
      return 'Formula Table';
    } else if (codeCell.language === 'Python') {
      return 'Python Table';
    } else if (codeCell.language === 'Javascript') {
      return 'JavaScript Table';
    } else if (typeof codeCell.language === 'object') {
      return codeCell.language.Connection?.kind;
    } else {
      throw new Error(`Unknown language: ${codeCell.language}`);
    }
  }, [codeCell]);

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
      <MenuHeader className="-ml-3">{header}</MenuHeader>
      <MenuItemAction action={Action.RenameTable} overrideDefaultOption={defaultRename} />
      <MenuItemAction action={Action.SortTable} />
      {hasHiddenColumns && <MenuItemAction action={Action.ShowAllColumns} />}
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
