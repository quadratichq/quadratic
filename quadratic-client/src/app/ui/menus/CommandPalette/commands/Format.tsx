import {
  DecimalDecreaseIcon,
  DecimalIncreaseIcon,
  DollarIcon,
  FunctionIcon,
  MagicWandIcon,
  PercentIcon,
  QuoteIcon,
  TextNoneIcon,
} from '@/app/ui/icons';
import { hasPermissionToEditFile } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import {
  clearFormattingAndBorders,
  removeCellNumericFormat,
  setCellCommas,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
} from '../../TopBar/SubMenus/formatCells';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

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
        return <CommandPaletteListItem {...props} action={removeCellNumericFormat} icon={<MagicWandIcon />} />;
      },
    },
    {
      label: 'Currency',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={textFormatSetCurrency} icon={<DollarIcon />} />;
      },
    },
    {
      label: 'Percentage',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={textFormatSetPercentage} icon={<PercentIcon />} />;
      },
    },
    {
      label: 'Scientific',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={textFormatSetExponential} icon={<FunctionIcon />} />;
      },
    },
    {
      label: 'Toggle commas',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={setCellCommas} icon={<QuoteIcon />} />;
      },
    },
    {
      label: 'Increase decimal',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} action={textFormatIncreaseDecimalPlaces} icon={<DecimalIncreaseIcon />} />
        );
      },
    },
    {
      label: 'Decrease decimal',
      isAvailable: hasPermissionToEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} action={textFormatDecreaseDecimalPlaces} icon={<DecimalDecreaseIcon />} />
        );
      },
    },
  ],
};

export default commands;
