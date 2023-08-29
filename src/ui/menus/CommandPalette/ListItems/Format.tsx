import { AbcOutlined, AttachMoney, FormatClear, Functions, Percent } from '@mui/icons-material';
import { isEditorOrAbove } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { DecimalDecrease, DecimalIncrease, Icon123 } from '../../../icons';
import { useClearAllFormatting } from '../../TopBar/SubMenus/useClearAllFormatting';
import { useFormatCells } from '../../TopBar/SubMenus/useFormatCells';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Format: Clear all',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { clearAllFormatting } = useClearAllFormatting(props.sheetController, props.app);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FormatClear />}
          action={() => {
            clearAllFormatting();
          }}
          shortcut="\"
          shortcutModifiers={KeyboardSymbols.Command}
        />
      );
    },
  },
  {
    label: 'Format: Style as plain text',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { textFormatClear } = useFormatCells(props.sheetController, props.app);
      return (
        <CommandPaletteListItem
          {...props}
          icon={<AbcOutlined />}
          action={() => {
            textFormatClear();
          }}
        />
      );
    },
  },
  {
    label: 'Format: Style as number',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { textFormatSetNumber } = useFormatCells(props.sheetController, props.app);
      return <CommandPaletteListItem {...props} icon={<Icon123 />} action={textFormatSetNumber} />;
    },
  },
  {
    label: 'Format: Style as currency',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { textFormatSetCurrency } = useFormatCells(props.sheetController, props.app);
      return <CommandPaletteListItem {...props} icon={<AttachMoney />} action={textFormatSetCurrency} />;
    },
  },
  {
    label: 'Format: Style as percentage',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { textFormatSetPercentage } = useFormatCells(props.sheetController, props.app);
      return <CommandPaletteListItem {...props} icon={<Percent />} action={textFormatSetPercentage} />;
    },
  },
  {
    label: 'Format: Style as scientific',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { textFormatSetExponential } = useFormatCells(props.sheetController, props.app);
      return <CommandPaletteListItem {...props} icon={<Functions />} action={textFormatSetExponential} />;
    },
  },
  {
    label: 'Format: Increase decimal place',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { textFormatIncreaseDecimalPlaces } = useFormatCells(props.sheetController, props.app);
      return <CommandPaletteListItem {...props} icon={<DecimalIncrease />} action={textFormatIncreaseDecimalPlaces} />;
    },
  },
  {
    label: 'Format: Decrease decimal place',
    isAvailable: isEditorOrAbove,
    Component: (props: any) => {
      const { textFormatDecreaseDecimalPlaces } = useFormatCells(props.sheetController, props.app);
      return <CommandPaletteListItem {...props} icon={<DecimalDecrease />} action={textFormatDecreaseDecimalPlaces} />;
    },
  },
];

export default ListItems;
