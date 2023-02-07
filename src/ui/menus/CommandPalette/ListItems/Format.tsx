import { useFormatCells } from '../../TopBar/SubMenus/useFormatCells';
import { useGetSelection } from '../../TopBar/SubMenus/useGetSelection';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { FormatBold, FormatItalic } from '@mui/icons-material';

const ListItems = [
  {
    label: 'Format: Bold',
    Component: (props: any) => {
      const selection = useGetSelection(props.sheetController.sheet);
      const format = useFormatCells(props.sheetController, props.app);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FormatBold />}
          action={() => {
            format.changeBold(!selection.format?.bold);
          }}
          shortcut="B"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Format: Italic',
    Component: (props: any) => {
      const selection = useGetSelection(props.sheetController.sheet);
      const format = useFormatCells(props.sheetController, props.app);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FormatItalic />}
          action={() => {
            format.changeItalic(!selection.format?.italic);
          }}
          shortcut="I"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
];

export default ListItems;
