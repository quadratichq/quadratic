import { AttachMoney, FormatClear, Functions, Percent } from '@mui/icons-material';
import { isEditorOrAbove } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { DecimalDecrease, DecimalIncrease, Icon123 } from '../../../icons';
import {
  clearFormattingAndBorders,
  removeCellNumericFormat,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
} from '../../TopBar/SubMenus/formatCells';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Format: Clear all',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FormatClear />}
          action={clearFormattingAndBorders}
          shortcut="\"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Format: Style as automatic',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<Icon123 />} action={removeCellNumericFormat} />;
    },
  },
  {
    label: 'Format: Style as currency',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<AttachMoney />} action={textFormatSetCurrency} />;
    },
  },
  {
    label: 'Format: Style as percentage',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<Percent />} action={textFormatSetPercentage} />;
    },
  },
  {
    label: 'Format: Style as scientific',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<Functions />} action={textFormatSetExponential} />;
    },
  },
  {
    label: 'Format: Increase decimal place',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<DecimalIncrease />} action={textFormatIncreaseDecimalPlaces} />;
    },
  },
  {
    label: 'Format: Decrease decimal place',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} icon={<DecimalDecrease />} action={textFormatDecreaseDecimalPlaces} />;
    },
  },
];

export default ListItems;
