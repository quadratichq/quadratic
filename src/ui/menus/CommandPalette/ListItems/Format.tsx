import { useFormatCells } from '../../TopBar/SubMenus/useFormatCells';
import { useGetSelection } from '../../TopBar/SubMenus/useGetSelection';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { CommandPaletteListItemCheckbox } from '../CommandPaletteListItemCheckbox';

const ListItems = [
  {
    label: 'Format: Bold',
    Component: (props: any) => {
      const selection = useGetSelection(props.sheetController.sheet)
      const format = useFormatCells(props.sheetController, props.app);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<CommandPaletteListItemCheckbox checked={!!selection.format?.bold} />}
          action={() => {
            format.changeBold(!selection.format?.bold)
          }}
        />
      );
    },
  },
  {
    label: 'Format: Italic',
    Component: (props: any) => {
      const selection = useGetSelection(props.sheetController.sheet)
      const format = useFormatCells(props.sheetController, props.app);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<CommandPaletteListItemCheckbox checked={!!selection.format?.italic} />}
          action={() => {
            format.changeItalic(!selection.format?.italic)
          }}
        />
      );
    },
  },
];

export default ListItems;
