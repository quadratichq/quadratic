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

// TODO: (jimniels)
// Convert these to the new action types from Ayush
// And use his keyboard shortcut typescript mappings

export const formatAlignHorizontalCenter = {
  label: 'Center',
  Icon: FormatAlignCenterIcon,
  // isAvailable
  run: () => {},
};

export const formatAlignHorizontalLeft = {
  label: 'Left',
  Icon: FormatAlignLeftIcon,
  // isAvailable
  run: () => {},
};

export const formatAlignHorizontalRight = {
  label: 'Right',
  Icon: FormatAlignRightIcon,
  // isAvailable
  run: () => {},
};

export const formatAlignVerticalBottom = {
  label: 'Center',
  Icon: VerticalAlignBottomIcon,
  // isAvailable
  run: () => {},
};

export const formatAlignVerticalMiddle = {
  label: 'Middle',
  Icon: VerticalAlignMiddleIcon,
  // isAvailable
  run: () => {},
};

export const formatAlignVerticalTop = {
  label: 'Top',
  // labelVerbose: 'Top align', for command palette
  Icon: VerticalAlignTopIcon,
  // isAvailable
  run: () => {},
};

export const formatBold = {
  label: 'Bold',
  keyboardShortcut: '⌘B',
  Icon: FormatBoldIcon,
  // isAvailable: (args) => args.filePermissions.includes('EDIT')
  run: () => {},
};

export const formatClear = {
  label: 'Clear formatting',
  keyboardShortcut: '⌘\\',
  Icon: FormatClearIcon,
  // isAvailable
  run: () => {},
};

export const formatItalic = {
  label: 'Italic',
  keyboardShortcut: '⌘I',
  Icon: FormatItalicIcon,
  // isAvailable
  run: () => {},
};

export const formatNumberAutomatic = {
  label: 'Automatic',
  labelVerbose: 'Format automatically',
  Icon: FormatNumberAutomaticIcon,
  // isAvailable
  run: () => {},
};

export const formatNumberCurrency = {
  label: 'Currency',
  labelVerbose: 'Format as currency',
  Icon: CurrencyIcon,
  // isAvailable
  run: () => {},
};

export const formatNumberDecimalDecrease = {
  label: 'Decrease decimals',
  Icon: DecimalDecreaseIcon,
  // isAvailable
  run: () => {},
};

export const formatNumberDecimalIncrease = {
  label: 'Increase decimals',
  Icon: DecimalIncreaseIcon,
  // isAvailable
  run: () => {},
};

export const formatNumberPercent = {
  label: 'Percent',
  labelVerbose: 'Format as percentage',
  Icon: PercentIcon,
  // isAvailable
  run: () => {},
};

export const formatNumberScientific = {
  label: 'Scientific',
  labelVerbose: 'Format as scientific',
  Icon: ScientificIcon,
  // isAvailable
  run: () => {},
};

export const formatNumberToggleCommas = {
  label: 'Toggle commas',
  // TODO: (jimniels) needs an icon
  Icon: FormatToggleCommasIcon,
  // isAvailable
  run: () => {},
};

export const formatTextWrappingClip = {
  label: 'Clip',
  Icon: FormatTextClipIcon,
  // isAvailable
  run: () => {},
};

export const formatTextWrappingOverflow = {
  label: 'Overflow',
  Icon: FormatTextOverflowIcon,
  // isAvailable
  run: () => {},
};

export const formatTextWrappingWrap = {
  label: 'Wrap',
  Icon: FormatTextWrapIcon,
  // isAvailable
  run: () => {},
};
