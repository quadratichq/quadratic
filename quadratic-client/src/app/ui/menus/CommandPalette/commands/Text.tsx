import {
  FontBoldIcon,
  FontItalicIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextClipIcon,
  TextOverflowIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  TextVerticalAlignBottomIcon,
  TextVerticalAlignMiddleIcon,
  TextVerticalAlignTopIcon,
  WrapTextIcon,
} from '@/app/ui/icons';
import { isAvailableBecauseCanEditFile } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import {
  setAlign,
  setBold,
  setItalic,
  setStrikeThrough,
  setUnderline,
  setVerticalAlign,
  setWrap,
} from '../../TopBar/SubMenus/formatCells';
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
      label: 'Underline',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextUnderlineIcon />} action={() => setUnderline()} />;
      },
    },
    {
      label: 'Strike-through',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextStrikethroughIcon />} action={() => setStrikeThrough()} />;
      },
    },
    {
      label: 'Left align',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextAlignLeftIcon />} action={() => setAlign('left')} />;
      },
    },
    {
      label: 'Center align',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextAlignCenterIcon />} action={() => setAlign('center')} />;
      },
    },
    {
      label: 'Right align',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextAlignRightIcon />} action={() => setAlign('right')} />;
      },
    },
    {
      label: 'Align top',
      isAvailable: isAvailableBecauseCanEditFile,
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
      isAvailable: isAvailableBecauseCanEditFile,
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
      isAvailable: isAvailableBecauseCanEditFile,
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
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextOverflowIcon />} action={() => setWrap('overflow')} />;
      },
    },
    {
      label: 'Text wrap',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<WrapTextIcon />} action={() => setWrap('wrap')} />;
      },
    },
    {
      label: 'Text clip',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} icon={<TextClipIcon />} action={() => setWrap('clip')} />;
      },
    },
  ],
};

export default commands;
