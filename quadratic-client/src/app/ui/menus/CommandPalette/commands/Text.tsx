import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import {
  setAlign,
  setBold,
  setItalic,
  setStrikeThrough,
  setUnderline,
  setVerticalAlign,
  setWrap,
} from '@/app/ui/helpers/formatCells';
import { CommandGroup, CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import {
  FormatAlignCenterIcon,
  FormatAlignLeftIcon,
  FormatAlignRightIcon,
  FormatBoldIcon,
  FormatItalicIcon,
  FormatStrikethroughIcon,
  FormatTextClipIcon,
  FormatTextOverflowIcon,
  FormatTextWrapIcon,
  FormatUnderlinedIcon,
  VerticalAlignBottomIcon,
  VerticalAlignMiddleIcon,
  VerticalAlignTopIcon,
} from '@/shared/components/Icons';

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
            icon={<FormatBoldIcon />}
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
            icon={<FormatItalicIcon />}
            action={async () => setItalic()}
            shortcut="I"
            shortcutModifiers={KeyboardSymbols.Command}
          />
        );
      },
    },
    {
      label: 'Underline',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<FormatUnderlinedIcon />} action={() => setUnderline()} />;
      },
    },
    {
      label: 'Strike-through',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} icon={<FormatStrikethroughIcon />} action={() => setStrikeThrough()} />
        );
      },
    },
    {
      label: 'Left align',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<FormatAlignLeftIcon />} action={() => setAlign('left')} />;
      },
    },
    {
      label: 'Center align',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<FormatAlignCenterIcon />} action={() => setAlign('center')} />;
      },
    },
    {
      label: 'Right align',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<FormatAlignRightIcon />} action={() => setAlign('right')} />;
      },
    },
    {
      label: 'Align top',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} icon={<VerticalAlignTopIcon />} action={() => setVerticalAlign('top')} />
        );
      },
    },
    {
      label: 'Align middle',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<VerticalAlignMiddleIcon />}
            action={() => setVerticalAlign('middle')}
          />
        );
      },
    },
    {
      label: 'Align bottom',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<VerticalAlignBottomIcon />}
            action={() => setVerticalAlign('bottom')}
          />
        );
      },
    },
    {
      label: 'Text overflow',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} icon={<FormatTextOverflowIcon />} action={() => setWrap('overflow')} />
        );
      },
    },
    {
      label: 'Text wrap',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<FormatTextWrapIcon />} action={() => setWrap('wrap')} />;
      },
    },
    {
      label: 'Text clip',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<FormatTextClipIcon />} action={() => setWrap('clip')} />;
      },
    },
  ],
};

export default commands;
