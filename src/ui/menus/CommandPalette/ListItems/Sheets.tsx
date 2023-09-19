import { grid } from '../../../../grid/controller/Grid';
import { sheets } from '../../../../grid/controller/Sheets';
import { focusGrid } from '../../../../helpers/focusGrid';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Sheet: Create',
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={() => sheets.createNew()} />;
    },
  },
  {
    label: 'Sheet: Delete',
    Component: (props: any) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            if (window.confirm(`Are you sure you want to delete ${sheets.sheet.name}?`)) {
              sheets.deleteSheet(sheets.sheet.id);
            }
            setTimeout(focusGrid);
          }}
        />
      );
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
