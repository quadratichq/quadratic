import {
  clearFormattingAndBorders,
  removeCellNumericFormat,
  setAlign,
  setBold,
  setCellCommas,
  setItalic,
  setVerticalAlign,
  setWrap,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
} from '@/app/ui/menus/TopBar/SubMenus/formatCells';
import {
  CurrencyIcon,
  DecimalDecreaseIcon,
  DecimalIncreaseIcon,
  FormatAlignCenterIcon,
  FormatAlignLeftIcon,
  FormatAlignRightIcon,
  FormatBoldIcon,
  FormatClearIcon,
  FormatItalicIcon,
  FormatNumberAutomaticIcon,
  FormatTextClipIcon,
  FormatTextOverflowIcon,
  FormatTextWrapIcon,
  FormatToggleCommasIcon,
  PercentIcon,
  ScientificIcon,
  VerticalAlignBottomIcon,
  VerticalAlignMiddleIcon,
  VerticalAlignTopIcon,
} from '@/shared/components/Icons';
import { ActionSpecRecord } from './actionSpec';
import { Action } from './actions';

// TODO: (jimniels) add isAvailable check for these (when you do command palette)

export const formatActionsSpec: ActionSpecRecord = {
  [Action.FormatAlignHorizontalCenter]: {
    label: 'Center',
    Icon: FormatAlignCenterIcon,
    run: () => {
      setAlign('center');
    },
  },
  [Action.FormatAlignHorizontalLeft]: {
    label: 'Left',
    Icon: FormatAlignLeftIcon,
    run: () => {
      setAlign('left');
    },
  },
  [Action.FormatAlignHorizontalRight]: {
    label: 'Right',
    Icon: FormatAlignRightIcon,
    run: () => {
      setAlign('right');
    },
  },
  [Action.FormatAlignVerticalBottom]: {
    label: 'Bottom',
    Icon: VerticalAlignBottomIcon,
    run: () => {
      setVerticalAlign('bottom');
    },
  },
  [Action.FormatAlignVerticalMiddle]: {
    label: 'Middle',
    Icon: VerticalAlignMiddleIcon,
    run: () => {
      setVerticalAlign('middle');
    },
  },
  [Action.FormatAlignVerticalTop]: {
    label: 'Top',
    Icon: VerticalAlignTopIcon,
    run: () => {
      setVerticalAlign('top');
    },
  },
  [Action.ToggleBold]: {
    label: 'Bold',
    Icon: FormatBoldIcon,
    run: () => {
      setBold();
    },
  },
  [Action.ToggleItalic]: {
    label: 'Italic',
    Icon: FormatItalicIcon,
    run: () => {
      setItalic();
    },
  },
  [Action.ClearFormattingBorders]: {
    label: 'Clear formatting',
    Icon: FormatClearIcon,
    run: () => {
      clearFormattingAndBorders();
    },
  },
  [Action.FormatNumberAutomatic]: {
    label: 'Automatic',
    Icon: FormatNumberAutomaticIcon,
    run: () => {
      removeCellNumericFormat();
    },
  },
  [Action.FormatNumberCurrency]: {
    label: 'Currency',
    Icon: CurrencyIcon,
    run: () => {
      textFormatSetCurrency();
    },
  },
  [Action.FormatNumberDecimalDecrease]: {
    label: 'Decrease decimals',
    Icon: DecimalDecreaseIcon,
    run: () => {
      textFormatDecreaseDecimalPlaces();
    },
  },
  [Action.FormatNumberDecimalIncrease]: {
    label: 'Increase decimals',
    Icon: DecimalIncreaseIcon,
    run: () => {
      textFormatIncreaseDecimalPlaces();
    },
  },
  [Action.FormatNumberPercent]: {
    label: 'Percent',
    Icon: PercentIcon,
    run: () => {
      textFormatSetPercentage();
    },
  },
  [Action.FormatNumberScientific]: {
    label: 'Scientific',
    Icon: ScientificIcon,
    run: () => {
      textFormatSetExponential();
    },
  },
  [Action.FormatNumberToggleCommas]: {
    label: 'Toggle commas',
    Icon: FormatToggleCommasIcon,
    run: () => {
      setCellCommas();
    },
  },
  [Action.FormatTextWrapClip]: {
    label: 'Clip',
    Icon: FormatTextClipIcon,
    run: () => {
      setWrap('clip');
    },
  },
  [Action.FormatTextWrapOverflow]: {
    label: 'Overflow',
    Icon: FormatTextOverflowIcon,
    run: () => {
      setWrap('overflow');
    },
  },
  [Action.FormatTextWrapWrap]: {
    label: 'Wrap',
    Icon: FormatTextWrapIcon,
    run: () => {
      setWrap('wrap');
    },
  },
};
