import {
  FontBoldIcon,
  FontItalicIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextClipIcon,
  TextOverflowIcon,
  TextVerticalAlignBottomIcon,
  TextVerticalAlignMiddleIcon,
  TextVerticalAlignTopIcon,
  WrapTextIcon,
} from '@/app/ui/icons';
import { hasPermissionToEditFile } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { setBold, setHorizontalAlign, setItalic, setVerticalAlign, setWrap } from '../../TopBar/SubMenus/formatCells';
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
      isAvailable: hasPermissionToEditFile,
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
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} icon={<TextAlignLeftIcon />} action={() => setHorizontalAlign('left')} />
        );
      },
    },
    {
      label: 'Center align',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<TextAlignCenterIcon />}
            action={() => setHorizontalAlign('center')}
          />
        );
      },
    },
    {
      label: 'Right align',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} icon={<TextAlignRightIcon />} action={() => setHorizontalAlign('right')} />
        );
      },
    },
    {
      label: 'Align top',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<TextVerticalAlignTopIcon />}
            action={() => setVerticalAlign('top')}
          />
        );
      },
    },
    {
      label: 'Align middle',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<TextVerticalAlignMiddleIcon />}
            action={() => setVerticalAlign('middle')}
          />
        );
      },
    },
    {
      label: 'Align bottom',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<TextVerticalAlignBottomIcon />}
            action={() => setVerticalAlign('bottom')}
          />
        );
      },
    },
    {
      label: 'Text overflow',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextOverflowIcon />} action={() => setWrap(undefined)} />;
      },
    },
    {
      label: 'Text wrap',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<WrapTextIcon />} action={() => setWrap('wrap')} />;
      },
    },
    {
      label: 'Text clip',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextClipIcon />} action={() => setWrap('clip')} />;
      },
    },
  ],
};

export default commands;
