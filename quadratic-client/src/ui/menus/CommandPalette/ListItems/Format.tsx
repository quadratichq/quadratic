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
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const TextIcon = ({ children }: any) => {
  return (
    <div className="relative h-5 w-5 text-center text-xl">
      <span style={{ lineHeight: 0, top: '-.333rem', position: 'relative' }}>{children}</span>
    </div>
  );
};

const ListItems = [
  {
    label: 'Format: Clear all',
    isAvailable: hasPermissionToEditFile,
    Component: (props: any) => {
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
    label: 'Format: Number as automatic',
    isAvailable: hasPermissionToEditFile,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={removeCellNumericFormat} />;
    },
  },
  {
    label: 'Format: Number as currency',
    isAvailable: hasPermissionToEditFile,
    Component: (props: any) => {
      return <CommandPaletteListItem icon={<TextIcon>$</TextIcon>} {...props} action={textFormatSetCurrency} />;
    },
  },
  {
    label: 'Format: Number as percentage',
    isAvailable: hasPermissionToEditFile,
    Component: (props: any) => {
      return <CommandPaletteListItem icon={<TextIcon>%</TextIcon>} {...props} action={textFormatSetPercentage} />;
    },
  },
  {
    label: 'Format: Number as scientific',
    isAvailable: hasPermissionToEditFile,
    Component: (props: any) => {
      return <CommandPaletteListItem icon={<TextIcon>Σ</TextIcon>} {...props} action={textFormatSetExponential} />;
    },
  },
  {
    label: 'Format: Number toggle commas',
    isAvailable: hasPermissionToEditFile,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={toggleCommas} />;
    },
  },
  {
    label: 'Format: Increase decimal place',
    isAvailable: hasPermissionToEditFile,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={textFormatIncreaseDecimalPlaces} />;
    },
  },
  {
    label: 'Format: Decrease decimal place',
    isAvailable: hasPermissionToEditFile,
    Component: (props: any) => {
      return <CommandPaletteListItem {...props} action={textFormatDecreaseDecimalPlaces} />;
    },
  },
];

export default ListItems;
