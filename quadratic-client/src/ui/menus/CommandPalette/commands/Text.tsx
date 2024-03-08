import {
  FontBoldIcon,
  FontItalicIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from '@radix-ui/react-icons';
import { hasPermissionToEditFile } from '../../../../actions';
import { sheets } from '../../../../grid/controller/Sheets';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { setAlignment, setBold, setItalic } from '../../TopBar/SubMenus/formatCells';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Text',
  commands: [
    {
      label: 'Bold',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<FontBoldIcon />}
            action={() => {
              setBold(!sheets.sheet.getFormatPrimaryCell()?.bold);
            }}
            shortcut="B"
            shortcutModifiers={[KeyboardSymbols.Command]}
          />
        );
      },
    },
    {
      label: 'Italic',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<FontItalicIcon />}
            action={() => {
              setItalic(!sheets.sheet.getFormatPrimaryCell()?.italic);
            }}
            shortcut="I"
            shortcutModifiers={KeyboardSymbols.Command}
          />
        );
      },
    },
    {
      label: 'Left align',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextAlignLeftIcon />} action={() => setAlignment('left')} />;
      },
    },
    {
      label: 'Center align',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} icon={<TextAlignCenterIcon />} action={() => setAlignment('center')} />
        );
      },
    },
    {
      label: 'Right align',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextAlignRightIcon />} action={() => setAlignment('right')} />;
      },
    },
  ],
};

export default commands;
