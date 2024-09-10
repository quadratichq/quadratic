import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';

import { MenubarItem, MenubarShortcut } from '@/shared/shadcn/ui/menubar';

type MenubarItemActionProps = {
  action:
    | Action.Undo
    | Action.Redo
    | Action.Cut
    | Action.Copy
    | Action.Paste
    | Action.PasteValuesOnly
    | Action.PasteFormattingOnly
    | Action.ShowGoToMenu
    | Action.FindInCurrentSheet
    | Action.FindInAllSheets
    | Action.CopyAsPng
    | Action.DownloadAsCsv
    | Action.FileShare
    | Action.FileRename
    | Action.FormatNumberAutomatic
    | Action.FormatNumberCurrency
    | Action.FormatNumberPercent
    | Action.FormatNumberScientific
    | Action.FormatNumberToggleCommas
    | Action.FormatNumberDecimalIncrease
    | Action.FormatNumberDecimalDecrease
    | Action.ToggleBold
    | Action.ToggleItalic
    | Action.FormatAlignHorizontalLeft
    | Action.FormatAlignHorizontalCenter
    | Action.FormatAlignHorizontalRight
    | Action.FormatAlignVerticalTop
    | Action.FormatAlignVerticalMiddle
    | Action.FormatAlignVerticalBottom
    | Action.FormatTextWrapWrap
    | Action.FormatTextWrapOverflow
    | Action.FormatTextWrapClip
    | Action.ClearFormattingBorders
    | Action.InsertCodePython
    | Action.InsertCodeJavascript
    | Action.InsertCodeFormula
    | Action.HelpContactUs
    | Action.InsertChartPython
    | Action.InsertChartJavascript
    | Action.InsertSheet
    | Action.ZoomIn
    | Action.ZoomOut
    | Action.ZoomToSelection
    | Action.ZoomToFit
    | Action.ZoomTo50
    | Action.ZoomTo100
    | Action.ZoomTo200;
  shortcutOverride?: string;
};

// TODO: (jimniels) implement types based on ayush's PR
export const MenubarItemAction = ({ action, shortcutOverride }: MenubarItemActionProps) => {
  const actionSpec = defaultActionSpec[action];
  if (!actionSpec) {
    throw new Error(`Action ${action} not found in defaultActionSpec`);
  }

  const { label, run } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  const labelVerbose = 'labelVerbose' in actionSpec ? actionSpec.labelVerbose : label;
  const keyboardShortcut = shortcutOverride ? shortcutOverride : keyboardShortcutEnumToDisplay(action);

  // TODO: (jimniels) implement isAvailable
  return (
    <MenubarItem onClick={() => run()}>
      {Icon && <Icon />} {labelVerbose}
      {keyboardShortcut && <MenubarShortcut>{keyboardShortcut}</MenubarShortcut>}
    </MenubarItem>
  );
};
