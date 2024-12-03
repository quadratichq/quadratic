import {
  CurrencyIcon,
  DecimalDecreaseIcon,
  DecimalIncreaseIcon,
  FormatClearIcon,
  FormatNumberAutomaticIcon,
  FormatToggleCommasIcon,
  PercentIcon,
  ScientificIcon,
} from '@/shared/components/Icons';
import DateRangeIcon from '@mui/icons-material/DateRange';
import { isAvailableBecauseCanEditFile } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import {
  clearFormattingAndBorders,
  removeNumericFormatSelection,
  setCellCommas,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
} from '../../../helpers/formatCells';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

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
            icon={<FormatClearIcon />}
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
        return (
          <CommandPaletteListItem
            {...props}
            action={removeNumericFormatSelection}
            icon={<FormatNumberAutomaticIcon />}
          />
        );
      },
    },
    {
      label: 'Currency',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={textFormatSetCurrency} icon={<CurrencyIcon />} />;
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
        return <CommandPaletteListItem {...props} action={textFormatSetExponential} icon={<ScientificIcon />} />;
      },
    },
    {
      label: 'Toggle commas',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={setCellCommas} icon={<FormatToggleCommasIcon />} />;
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
