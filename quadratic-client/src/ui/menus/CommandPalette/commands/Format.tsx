import { TextNoneIcon } from '@radix-ui/react-icons';
import { hasPermissionToEditFile } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import {
  clearFormattingAndBorders,
  removeCellNumericFormat,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
  toggleCommas,
} from '../../TopBar/SubMenus/formatCells';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const TextIcon = ({ children }: { children: string }) => {
  return (
    <div className="relative h-5 w-5 text-center text-xl">
      <span style={{ lineHeight: 0, top: '-.333rem', position: 'relative' }}>{children}</span>
    </div>
  );
};

const commands: CommandGroup = {
  heading: 'Format',
  commands: [
    {
      label: 'Clear formatting',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            icon={<TextNoneIcon />}
            action={clearFormattingAndBorders}
            shortcut="\"
            shortcutModifiers={KeyboardSymbols.Command}
          />
        );
      },
    },
    {
      label: 'Automatic',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={removeCellNumericFormat} />;
      },
    },
    {
      label: 'Currency',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem icon={<TextIcon>$</TextIcon>} {...props} action={textFormatSetCurrency} />;
      },
    },
    {
      label: 'Percentage',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem icon={<TextIcon>%</TextIcon>} {...props} action={textFormatSetPercentage} />;
      },
    },
    {
      label: 'Scientific',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem icon={<TextIcon>Σ</TextIcon>} {...props} action={textFormatSetExponential} />;
      },
    },
    {
      label: 'Toggle commas',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={toggleCommas} />;
      },
    },
    {
      label: 'Increase decimal',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={textFormatIncreaseDecimalPlaces} />;
      },
    },
    {
      label: 'Decrease decimal',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={textFormatDecreaseDecimalPlaces} />;
      },
    },
  ],
};

export default commands;
