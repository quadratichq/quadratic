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
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { hasPermissionToEditFile } from '../../../../actions';
import { sheets } from '../../../../grid/controller/Sheets';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import {
  setBold,
  setHorizontalAlignment,
  setItalic,
  setVerticalAlignment,
  setWrap,
} from '../../TopBar/SubMenus/formatCells';
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
              const summary = await quadraticCore.getCellFormatSummary(
                sheets.sheet.id,
                sheets.sheet.cursor.originPosition.x,
                sheets.sheet.cursor.originPosition.y
              );
              setBold(!summary.bold);
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
            action={async () => {
              const summary = await quadraticCore.getCellFormatSummary(
                sheets.sheet.id,
                sheets.sheet.cursor.originPosition.x,
                sheets.sheet.cursor.originPosition.y
              );
              setItalic(!summary.italic);
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
        return (
          <CommandPaletteListItem
            {...props}
            icon={<TextAlignLeftIcon />}
            action={() => setHorizontalAlignment('left')}
          />
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
            action={() => setHorizontalAlignment('center')}
          />
        );
      },
    },
    {
      label: 'Right align',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<TextAlignRightIcon />}
            action={() => setHorizontalAlignment('right')}
          />
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
            action={() => setVerticalAlignment('top')}
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
            action={() => setVerticalAlignment('middle')}
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
            action={() => setVerticalAlignment('bottom')}
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
