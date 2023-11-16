import { isEditorOrAbove } from '../../../../actions';
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
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Format: Clear all',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={clearFormattingAndBorders}
          shortcut="\"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Format: Number as automatic',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={removeCellNumericFormat} />;
    },
  },
  {
    label: 'Format: Number as currency',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={textFormatSetCurrency} />;
    },
  },
  {
    label: 'Format: Number as percentage',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={textFormatSetPercentage} />;
    },
  },
  {
    label: 'Format: Number as scientific',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={textFormatSetExponential} />;
    },
  },
  {
    label: 'Format: Number toggle commas',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={toggleCommas} />;
    },
  },
  {
    label: 'Format: Increase decimal place',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={textFormatIncreaseDecimalPlaces} />;
    },
  },
  {
    label: 'Format: Decrease decimal place',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={textFormatDecreaseDecimalPlaces} />;
    },
  },
];

export default ListItems;
