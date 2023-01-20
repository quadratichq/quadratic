import { Checkbox as MUICheckbox } from '@mui/material';
import {
  BorderAll,
  BorderOuter,
  BorderTop,
  BorderRight,
  BorderLeft,
  BorderBottom,
  BorderInner,
  BorderHorizontal,
  BorderVertical,
  FormatBold,
  FormatItalic,
  FormatColorText,
  FormatAlignCenter,
  FormatAlignLeft,
  FormatAlignRight,
  BorderClear,
  OpenInNew,
  FormatUnderlined,
  FormatColorFill,
  FormatClear,
} from '@mui/icons-material';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';

export interface IQuadraticCommand {
  name: string;
  action?: any; // @TODO action to run when selected
  icon?: any;
  disabled?: boolean | undefined;
  shortcut?: string;
  shortcutModifiers?: Array<string>;
}

// @TODO iterate over commands and apply aria-label and checked state
const Checkbox = () => (
  <MUICheckbox sx={{ p: 0 }} checked={true} tabIndex={-1} disableRipple inputProps={{ 'aria-labelledby': '@TODO' }} />
);

export const commands = [
  {
    name: 'Copy',
    shortcut: 'C',
    shortcutModifiers: [KeyboardSymbols.Command],
  },
  {
    name: 'Paste',
    shortcut: 'V',
    shortcutModifiers: [KeyboardSymbols.Command],
  },
  {
    name: 'Cut',
    shortcut: 'X',
    shortcutModifiers: [KeyboardSymbols.Command],
    disabled: true,
  },
  {
    name: 'Undo',
    shortcut: 'Z',
    shortcutModifiers: [KeyboardSymbols.Command],
  },
  {
    name: 'Redo',
    shortcut: 'Z',
    shortcutModifiers: [KeyboardSymbols.Command, KeyboardSymbols.Shift],
  },

  {
    name: 'File: New',
  },
  {
    name: 'File: Save local copy',
  },
  {
    name: 'File: Open local',
  },
  {
    name: 'Borders: Apply to all',
    icon: <BorderAll />,
  },
  {
    name: 'Borders: Apply outer',
    icon: <BorderOuter />,
  },
  {
    name: 'Borders: Apply inner',
    icon: <BorderInner />,
  },
  {
    name: 'Borders: Apply vertical',
    icon: <BorderVertical />,
  },
  {
    name: 'Borders: Apply horizontal',
    icon: <BorderHorizontal />,
  },
  {
    name: 'Borders: Apply left',
    icon: <BorderLeft />,
  },
  {
    name: 'Borders: Apply right',
    icon: <BorderRight />,
  },
  {
    name: 'Borders: Apply top',
    icon: <BorderTop />,
  },
  {
    name: 'Borders: Apply bottom',
    icon: <BorderBottom />,
  },
  {
    name: 'Borders: Clear all',
    icon: <BorderClear />,
  },
  {
    name: 'View: Show row and column headings',
    icon: <Checkbox />,
  },
  {
    name: 'View: Show axis',
    icon: <Checkbox />,
  },
  {
    name: 'View: Show grid lines',
    icon: <Checkbox />,
  },
  {
    name: 'View: Show cell type outlines',
    icon: <Checkbox />,
  },
  {
    name: 'View: Show debug menu',
    icon: <Checkbox />,
  },
  // Make sure the zoom commands are in the same order as they are in the menu
  {
    name: 'View: Zoom to fit',
    shortcut: '1',
    shortcutModifiers: [KeyboardSymbols.Shift],
  },
  {
    name: 'View: Zoom in',
    shortcut: '+',
    shortcutModifiers: [KeyboardSymbols.Command],
  },
  {
    name: 'View: Zoom out',
    shortcut: '−',
    shortcutModifiers: [KeyboardSymbols.Command],
  },
  {
    name: 'View: Zoom to 50%',
  },
  {
    name: 'View: Zoom to 100%',
    shortcut: '0',
    shortcutModifiers: [KeyboardSymbols.Command],
  },
  {
    name: 'View: Zoom to 200%',
  },
  {
    name: 'Help: View the docs',
    icon: <OpenInNew />,
  },
  {
    name: 'Help: Report a problem',
    icon: <OpenInNew />,
  },
  {
    name: 'Import: CSV',
    disabled: true,
  },
  {
    name: 'Import: Excel',
    disabled: true,
  },
  {
    name: 'Text: Bold',
    icon: <FormatBold />,
    disabled: true,
  },
  {
    name: 'Text: Italicize',
    icon: <FormatItalic />,
    disabled: true,
  },
  {
    name: 'Text: Underline',
    icon: <FormatUnderlined />,
    disabled: true,
  },
  {
    name: 'Text: Change color',
    icon: <FormatColorText />,
    disabled: true,
  },
  {
    name: 'Text: Wrap text',
    disabled: true,
  },
  {
    name: 'Text: Wrap text overflow',
    disabled: true,
  },
  {
    name: 'Text: Wrap text clip',
    disabled: true,
  },
  {
    name: 'Text: Align left',
    icon: <FormatAlignLeft />,
    disabled: true,
  },
  {
    name: 'Text: Align center',
    icon: <FormatAlignCenter />,
    disabled: true,
  },
  {
    name: 'Text: Align right',
    icon: <FormatAlignRight />,
    disabled: true,
  },
  {
    name: 'Format: Fill color',
    icon: <FormatColorFill />,
    disabled: true,
  },
  {
    name: 'Format: Clear fill color',
    disabled: true,
  },
  {
    name: 'Format: Clear all',
    icon: <FormatClear />,
    disabled: true,
  },
] as IQuadraticCommand[];
