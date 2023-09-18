import { grid } from '../../../../grid/controller/Grid';
import { sheets } from '../../../../grid/controller/Sheets';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Sheet: Create',
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={grid.addSheet} />;
    },
  },
  {
    label: 'Sheet: Delete',
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={props.confirmDelete} />;
    },
  },
  {
    label: 'Sheet: Duplicate',
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={() => grid.duplicateSheet(sheets.sheet.id)} />;
    },
  },
];

export default ListItems;
