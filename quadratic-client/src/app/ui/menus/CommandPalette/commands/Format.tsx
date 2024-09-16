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
import { isAvailableBecauseCanEditFile } from '../../../../actions';
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
import DateRangeIcon from '@mui/icons-material/DateRange';

const commands: CommandGroup = {
  heading: 'Format',
  commands: [
    {
      label: 'Clear formatting',
      isAvailable: isAvailableBecauseCanEditFile,
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
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={removeCellNumericFormat} icon={<MagicWandIcon />} />;
      },
    },
    {
      label: 'Currency',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={textFormatSetCurrency} icon={<DollarIcon />} />;
      },
    },
    {
      label: 'Percentage',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={textFormatSetPercentage} icon={<PercentIcon />} />;
      },
    },
    {
      label: 'Scientific',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={textFormatSetExponential} icon={<FunctionIcon />} />;
      },
    },
    {
      label: 'Toggle commas',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={setCellCommas} icon={<QuoteIcon />} />;
      },
    },
    {
      label: 'Increase decimal',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} action={textFormatIncreaseDecimalPlaces} icon={<DecimalIncreaseIcon />} />
        );
      },
    },
    {
      label: 'Decrease decimal',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem {...props} action={textFormatDecreaseDecimalPlaces} icon={<DecimalDecreaseIcon />} />
        );
      },
    },
    {
      label: 'Date and time format',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={props.openDateFormat} icon={<DateRangeIcon />} />;
      },
    },
  ],
};

export default commands;
