import { FormatAlignCenter, FormatAlignLeft, FormatAlignRight, FormatBold, FormatItalic } from '@mui/icons-material';
import { isEditorOrAbove } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { useFormatCells } from '../../TopBar/SubMenus/useFormatCells';
import { useGetSelection } from '../../TopBar/SubMenus/useGetSelection';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Text: Bold',
    isAvailable: isEditorOrAbove,
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
    label: 'Text: Italic',
    isAvailable: isEditorOrAbove,
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
  {
    label: 'Text: Align left',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { changeAlignment } = useFormatCells(props.sheetController, props.app);
      return <CommandPaletteListItem {...props} icon={<FormatAlignLeft />} action={() => changeAlignment('left')} />;
    },
  },
  {
    label: 'Text: Align center',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { changeAlignment } = useFormatCells(props.sheetController, props.app);
      return (
        <CommandPaletteListItem {...props} icon={<FormatAlignCenter />} action={() => changeAlignment('center')} />
      );
    },
  },
  {
    label: 'Text: Align right',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { changeAlignment } = useFormatCells(props.sheetController, props.app);
      return <CommandPaletteListItem {...props} icon={<FormatAlignRight />} action={() => changeAlignment('right')} />;
    },
  },
];

export default ListItems;
