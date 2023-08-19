import { FormatAlignCenter, FormatAlignLeft, FormatAlignRight, FormatBold, FormatItalic } from '@mui/icons-material';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { useFormatCells } from '../../TopBar/SubMenus/useFormatCells';
import { useGetSelection } from '../../TopBar/SubMenus/useGetSelection';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Text: Bold',
    Component: (props: any) => {
      const selection = useGetSelection(props.sheetController.sheet);
      const format = useFormatCells(props.sheetController);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FormatBold />}
          action={() => {
            format.setBold(!selection.formatPrimaryCell?.bold);
          }}
          shortcut="B"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Text: Italic',
    Component: (props: any) => {
      const selection = useGetSelection(props.sheetController.sheet);
      const format = useFormatCells(props.sheetController);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FormatItalic />}
          action={() => {
            format.setItalic(!selection.formatPrimaryCell?.italic);
          }}
          shortcut="I"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Text: Align left',
    Component: (props: any) => {
      const { setAlignment: changeAlignment } = useFormatCells(props.sheetController);
      return <CommandPaletteListItem {...props} icon={<FormatAlignLeft />} action={() => changeAlignment('left')} />;
    },
  },
  {
    label: 'Text: Align center',
    Component: (props: any) => {
      const { setAlignment: changeAlignment } = useFormatCells(props.sheetController);
      return (
        <CommandPaletteListItem {...props} icon={<FormatAlignCenter />} action={() => changeAlignment('center')} />
      );
    },
  },
  {
    label: 'Text: Align right',
    Component: (props: any) => {
      const { setAlignment: changeAlignment } = useFormatCells(props.sheetController);
      return <CommandPaletteListItem {...props} icon={<FormatAlignRight />} action={() => changeAlignment('right')} />;
    },
  },
];

export default ListItems;
