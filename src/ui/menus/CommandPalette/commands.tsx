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

export interface QuadraticCommand {
  name: string;
  action?: any; // @TODO action to run when selected
  icon?: any;
  disabled?: boolean | undefined;
  // comingSoon?: boolean | undefined;
  shortcut?: string;
  shortcutModifiers?: Array<'ctrl' | 'shift' | 'alt'>;

  // type: "icon" | "toggle" | "text";
}

// @TODO iterate over commands and apply aria-label and checked state
const Checkbox = () => (
  <MUICheckbox sx={{ p: 0 }} checked={true} tabIndex={-1} disableRipple inputProps={{ 'aria-labelledby': '@TODO' }} />
);

export const commands = [
  {
    name: 'Copy',
    shortcut: 'C',
    shortcutModifiers: ['ctrl'],
  },
  {
    name: 'Paste',
    shortcut: 'V',
    shortcutModifiers: ['ctrl'],
  },
  {
    name: 'Cut',
    shortcut: 'X',
    shortcutModifiers: ['ctrl'],
    disabled: true,
  },
  {
    name: 'Undo',
    shortcut: 'Z',
    shortcutModifiers: ['ctrl'],
  },
  {
    name: 'Redo',
    shortcut: 'Z',
    shortcutModifiers: ['ctrl', 'shift'],
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
    name: 'Borders: Apply borders to all',
    icon: <BorderAll />,
  },
  {
    name: 'Borders: Apply outer borders',
    icon: <BorderOuter />,
  },
  {
    name: 'Borders: Apply inner borders',
    icon: <BorderInner />,
  },
  {
    name: 'Borders: Apply vertical borders',
    icon: <BorderVertical />,
  },
  {
    name: 'Borders: Apply horizontal borders',
    icon: <BorderHorizontal />,
  },
  {
    name: 'Borders: Apply left border',
    icon: <BorderLeft />,
  },
  {
    name: 'Borders: Apply right border',
    icon: <BorderRight />,
  },
  {
    name: 'Borders: Apply top border',
    icon: <BorderTop />,
  },
  {
    name: 'Borders: Apply bottom border',
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
    shortcutModifiers: ['shift'],
  },
  {
    name: 'View: Zoom in',
    shortcut: '+',
    shortcutModifiers: ['ctrl'],
  },
  {
    name: 'View: Zoom out',
    shortcut: '−',
    shortcutModifiers: ['ctrl'],
  },
  {
    name: 'View: Zoom to 50%',
  },
  {
    name: 'View: Zoom to 100%',
    shortcut: '0',
    shortcutModifiers: ['ctrl'],
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
] as QuadraticCommand[];
