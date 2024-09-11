import { Action } from '@/app/actions/actions';
import { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { UseBordersResults } from '@/app/ui/hooks/useBorders';
import {
  clearFormattingAndBorders,
  removeCellNumericFormat,
  setAlign,
  setBold,
  setCellCommas,
  setFillColor,
  setItalic,
  setTextColor,
  setVerticalAlign,
  setWrap,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
} from '@/app/ui/menus/TopBar/SubMenus/formatCells';
import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderClearIcon,
  BorderHorizontalIcon,
  BorderInnerIcon,
  BorderLeftIcon,
  BorderOuterIcon,
  BorderRightIcon,
  BorderTopIcon,
  BorderVerticalIcon,
  CurrencyIcon,
  DecimalDecreaseIcon,
  DecimalIncreaseIcon,
  FormatAlignCenterIcon,
  FormatAlignLeftIcon,
  FormatAlignRightIcon,
  FormatBoldIcon,
  FormatClearIcon,
  FormatColorFillIcon,
  FormatColorTextIcon,
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
import { ColorResult } from 'react-color';

// TODO: (jimniels) add isAvailable check for these (when you do command palette)

export type FormatActionArgs = {
  [Action.FormatTextColor]?: ColorResult;
  [Action.FormatFillColor]?: ColorResult;
  [Action.FormatBorderAll]: UseBordersResults;
  [Action.FormatBorderOuter]: UseBordersResults;
  [Action.FormatBorderInner]: UseBordersResults;
  [Action.FormatBorderVertical]: UseBordersResults;
  [Action.FormatBorderHorizontal]: UseBordersResults;
  [Action.FormatBorderLeft]: UseBordersResults;
  [Action.FormatBorderRight]: UseBordersResults;
  [Action.FormatBorderTop]: UseBordersResults;
  [Action.FormatBorderBottom]: UseBordersResults;
  [Action.FormatBorderClear]: UseBordersResults;
};

export const formatActionsSpec: Partial<ActionSpecRecord> = {
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
  [Action.FormatTextColor]: {
    label: 'Text color',
    Icon: FormatColorTextIcon,
    run: (color: FormatActionArgs[Action.FormatTextColor]) => {
      setTextColor(color);
    },
  },
  [Action.FormatFillColor]: {
    label: 'Fill color',
    Icon: FormatColorFillIcon,
    run: (color: FormatActionArgs[Action.FormatFillColor]) => {
      setFillColor(color);
    },
  },
  [Action.FormatBorderAll]: {
    label: 'Border all',
    Icon: BorderAllIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderAll]) => {
      borders.changeBorders({ selection: 'all' });
    },
  },
  [Action.FormatBorderOuter]: {
    label: 'Border outer',
    Icon: BorderOuterIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderOuter]) => {
      borders.changeBorders({ selection: 'outer' });
    },
  },
  [Action.FormatBorderInner]: {
    label: 'Border inner',
    Icon: BorderInnerIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderInner]) => {
      borders.changeBorders({ selection: 'inner' });
    },
  },
  [Action.FormatBorderVertical]: {
    label: 'Border vertical',
    Icon: BorderVerticalIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderVertical]) => {
      borders.changeBorders({ selection: 'vertical' });
    },
  },
  [Action.FormatBorderHorizontal]: {
    label: 'Border horizontal',
    Icon: BorderHorizontalIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderHorizontal]) => {
      borders.changeBorders({ selection: 'horizontal' });
    },
  },
  [Action.FormatBorderLeft]: {
    label: 'Border left',
    Icon: BorderLeftIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderLeft]) => {
      borders.changeBorders({ selection: 'left' });
    },
  },
  [Action.FormatBorderRight]: {
    label: 'Border right',
    Icon: BorderRightIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderRight]) => {
      borders.changeBorders({ selection: 'right' });
    },
  },
  [Action.FormatBorderTop]: {
    label: 'Border top',
    Icon: BorderTopIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderTop]) => {
      borders.changeBorders({ selection: 'top' });
    },
  },
  [Action.FormatBorderBottom]: {
    label: 'Border bottom',
    Icon: BorderBottomIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderBottom]) => {
      borders.changeBorders({ selection: 'bottom' });
    },
  },
  [Action.FormatBorderClear]: {
    label: 'Border clear',
    Icon: BorderClearIcon,
    run: (borders: FormatActionArgs[Action.FormatBorderClear]) => {
      borders.clearBorders();
    },
  },
};
