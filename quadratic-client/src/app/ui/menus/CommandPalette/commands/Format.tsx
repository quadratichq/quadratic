import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import {
  clearFormattingAndBorders,
  removeNumericFormat,
  setCellCommas,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
} from '@/app/ui/helpers/formatCells';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import {
  CurrencyIcon,
  DecimalDecreaseIcon,
  DecimalIncreaseIcon,
  FormatClearIcon,
  FormatDateTimeIcon,
  FormatNumberAutomaticIcon,
  FormatToggleCommasIcon,
  PercentIcon,
  ScientificIcon,
} from '@/shared/components/Icons';

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
        return <CommandPaletteListItem {...props} action={removeNumericFormat} icon={<FormatNumberAutomaticIcon />} />;
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
        return <CommandPaletteListItem {...props} action={props.openDateFormat} icon={<FormatDateTimeIcon />} />;
      },
    },
    Action.MergeCells,
    Action.UnmergeCells,
  ],
};

export default commands;
