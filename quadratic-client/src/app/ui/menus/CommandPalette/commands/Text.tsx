import {
  FontBoldIcon,
  FontItalicIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from '@/app/ui/icons';
import { isAvailableBecauseCanEditFile } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { setAlignment, setBold, setItalic } from '../../TopBar/SubMenus/formatCells';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Text',
  commands: [
    {
      label: 'Bold',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<FontBoldIcon />}
            action={async () => {
              setBold();
            }}
            shortcut="B"
            shortcutModifiers={[KeyboardSymbols.Command]}
          />
        );
      },
    },
    {
      label: 'Italic',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<FontItalicIcon />}
            action={async () => setItalic()}
            shortcut="I"
            shortcutModifiers={KeyboardSymbols.Command}
          />
        );
      },
    },
    {
      label: 'Left align',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextAlignLeftIcon />} action={() => setAlignment('left')} />;
      },
    },
    {
      label: 'Center align',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} icon={<TextAlignCenterIcon />} action={() => setAlignment('center')} />
        );
      },
    },
    {
      label: 'Right align',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextAlignRightIcon />} action={() => setAlignment('right')} />;
      },
    },
  ],
};

export default commands;
