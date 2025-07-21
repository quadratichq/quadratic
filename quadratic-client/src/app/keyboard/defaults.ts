import { Action } from '@/app/actions/actions';
import { Keys, MacModifiers, WindowsModifiers } from '@/app/keyboard/keys';
import type { ActionShortcut } from '@/app/keyboard/shortcut';

export const defaultShortcuts: ActionShortcut = {
  [Action.CmdClick]: {
    mac: [[MacModifiers.Cmd]],
    windows: [[WindowsModifiers.Ctrl]],
  },
  [Action.Copy]: {
    mac: [[MacModifiers.Cmd, Keys.C]],
    windows: [[WindowsModifiers.Ctrl, Keys.C]],
  },
  [Action.Cut]: {
    mac: [[MacModifiers.Cmd, Keys.X]],
    windows: [[WindowsModifiers.Ctrl, Keys.X]],
  },
  [Action.Paste]: {
    mac: [[MacModifiers.Cmd, Keys.V]],
    windows: [[WindowsModifiers.Ctrl, Keys.V]],
  },
  [Action.PasteValuesOnly]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.V]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.V]],
  },
  [Action.FindInCurrentSheet]: {
    mac: [[MacModifiers.Cmd, Keys.F]],
    windows: [[WindowsModifiers.Ctrl, Keys.F]],
  },
  [Action.FindInAllSheets]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.F]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.F]],
  },
  [Action.GridPanMode]: {
    mac: [[Keys.Space]],
    windows: [[Keys.Space]],
  },
  [Action.ShowCommandPalette]: {
    mac: [
      [MacModifiers.Cmd, Keys.P],
      [MacModifiers.Cmd, Keys.Slash],
    ],
    windows: [
      [WindowsModifiers.Ctrl, Keys.P],
      [WindowsModifiers.Ctrl, Keys.Slash],
    ],
  },
  [Action.TogglePresentationMode]: {
    mac: [[MacModifiers.Cmd, Keys.Period]],
    windows: [[WindowsModifiers.Ctrl, Keys.Period]],
  },
  [Action.CloseOverlay]: {
    mac: [[Keys.Escape]],
    windows: [[Keys.Escape]],
  },
  [Action.ShowGoToMenu]: {
    mac: [
      [MacModifiers.Cmd, Keys.G],
      [MacModifiers.Cmd, Keys.J],
    ],
    windows: [
      [WindowsModifiers.Ctrl, Keys.G],
      [WindowsModifiers.Ctrl, Keys.J],
    ],
  },
  [Action.ZoomIn]: {
    mac: [
      [MacModifiers.Cmd, Keys.Plus],
      [MacModifiers.Cmd, Keys.Equals],
    ],
    windows: [
      [WindowsModifiers.Ctrl, Keys.Plus],
      [WindowsModifiers.Ctrl, Keys.Equals],
    ],
  },
  [Action.ZoomOut]: {
    mac: [[MacModifiers.Cmd, Keys.Minus]],
    windows: [[WindowsModifiers.Ctrl, Keys.Minus]],
  },
  [Action.ZoomToSelection]: {
    mac: [[MacModifiers.Cmd, Keys.Eight]],
    windows: [[WindowsModifiers.Ctrl, Keys.Eight]],
  },
  [Action.ZoomToFit]: {
    mac: [[MacModifiers.Cmd, Keys.Nine]],
    windows: [[WindowsModifiers.Ctrl, Keys.Nine]],
  },
  [Action.ZoomTo100]: {
    mac: [[MacModifiers.Cmd, Keys.Zero]],
    windows: [[WindowsModifiers.Ctrl, Keys.Zero]],
  },
  [Action.Save]: {
    mac: [[MacModifiers.Cmd, Keys.S]],
    windows: [[WindowsModifiers.Ctrl, Keys.S]],
  },
  [Action.SwitchSheetNext]: {
    mac: [
      [MacModifiers.Cmd, MacModifiers.Shift, Keys.PageUp],
      [MacModifiers.Cmd, MacModifiers.Alt, Keys.PageUp],
      [MacModifiers.Alt, Keys.ArrowUp],
      [MacModifiers.Alt, Keys.ArrowRight],
    ],
    windows: [
      [WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.PageUp],
      [WindowsModifiers.Ctrl, WindowsModifiers.Alt, Keys.PageUp],
      [WindowsModifiers.Alt, Keys.ArrowUp],
      [WindowsModifiers.Alt, Keys.ArrowRight],
    ],
  },
  [Action.SwitchSheetPrevious]: {
    mac: [
      [MacModifiers.Cmd, MacModifiers.Shift, Keys.PageDown],
      [MacModifiers.Cmd, MacModifiers.Alt, Keys.PageDown],
      [MacModifiers.Alt, Keys.ArrowDown],
      [MacModifiers.Alt, Keys.ArrowLeft],
    ],
    windows: [
      [WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.PageDown],
      [WindowsModifiers.Ctrl, WindowsModifiers.Alt, Keys.PageDown],
      [WindowsModifiers.Alt, Keys.ArrowDown],
      [WindowsModifiers.Alt, Keys.ArrowLeft],
    ],
  },
  [Action.ClearFormattingBorders]: {
    mac: [[MacModifiers.Cmd, Keys.Backslash]],
    windows: [[WindowsModifiers.Ctrl, Keys.Backslash]],
  },
  [Action.ToggleBold]: {
    mac: [[MacModifiers.Cmd, Keys.B]],
    windows: [[WindowsModifiers.Ctrl, Keys.B]],
  },
  [Action.ToggleItalic]: {
    mac: [[MacModifiers.Cmd, Keys.I]],
    windows: [[WindowsModifiers.Ctrl, Keys.I]],
  },
  [Action.ToggleUnderline]: {
    mac: [[MacModifiers.Cmd, Keys.U]],
    windows: [[WindowsModifiers.Ctrl, Keys.U]],
  },
  [Action.ToggleStrikeThrough]: {
    mac: [[MacModifiers.Cmd, Keys.Five]],
    windows: [[WindowsModifiers.Ctrl, Keys.Five]],
  },
  [Action.FillRight]: {
    mac: [[MacModifiers.Cmd, Keys.R]],
    windows: [[WindowsModifiers.Ctrl, Keys.R]],
  },
  [Action.FillDown]: {
    mac: [[MacModifiers.Cmd, Keys.D]],
    windows: [[WindowsModifiers.Ctrl, Keys.D]],
  },
  [Action.CancelExecution]: {
    mac: [[MacModifiers.Cmd, Keys.Escape]],
    windows: [[WindowsModifiers.Ctrl, Keys.Escape]],
  },
  [Action.CopyAsPng]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.C]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.C]],
  },
  [Action.DownloadAsCsv]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.E]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.E]],
  },
  [Action.Undo]: {
    mac: [[MacModifiers.Cmd, Keys.Z]],
    windows: [[WindowsModifiers.Ctrl, Keys.Z]],
  },
  [Action.Redo]: {
    mac: [
      [MacModifiers.Cmd, MacModifiers.Shift, Keys.Z],
      [MacModifiers.Cmd, Keys.Y],
    ],
    windows: [
      [WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.Z],
      [WindowsModifiers.Ctrl, Keys.Y],
    ],
  },
  [Action.SelectAll]: {
    mac: [
      [MacModifiers.Cmd, Keys.A],
      [MacModifiers.Cmd, MacModifiers.Shift, Keys.Space],
    ],
    windows: [
      [WindowsModifiers.Ctrl, Keys.A],
      [WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.Space],
    ],
  },
  [Action.SelectColumn]: {
    mac: [[MacModifiers.Cmd, Keys.Space]],
    windows: [[WindowsModifiers.Ctrl, Keys.Space]],
  },
  [Action.SelectRow]: {
    mac: [[MacModifiers.Shift, Keys.Space]],
    windows: [[WindowsModifiers.Shift, Keys.Space]],
  },
  [Action.ExecuteCode]: {
    mac: [[MacModifiers.Cmd, Keys.Enter]],
    windows: [[WindowsModifiers.Ctrl, Keys.Enter]],
  },
  [Action.RerunSheetCode]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, MacModifiers.Alt, Keys.Enter]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, WindowsModifiers.Alt, Keys.Enter]],
  },
  [Action.RerunAllCode]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.Enter]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.Enter]],
  },
  [Action.InsertCellReference]: {
    mac: [[MacModifiers.Cmd, Keys.L]],
    windows: [[WindowsModifiers.Ctrl, Keys.L]],
  },
  [Action.MoveCursorUp]: {
    mac: [[Keys.ArrowUp]],
    windows: [[Keys.ArrowUp]],
  },
  [Action.JumpCursorContentTop]: {
    mac: [[MacModifiers.Cmd, Keys.ArrowUp]],
    windows: [[WindowsModifiers.Ctrl, Keys.ArrowUp]],
  },
  [Action.ExpandSelectionUp]: {
    mac: [[MacModifiers.Shift, Keys.ArrowUp]],
    windows: [[WindowsModifiers.Shift, Keys.ArrowUp]],
  },
  [Action.ExpandSelectionContentTop]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.ArrowUp]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.ArrowUp]],
  },
  [Action.MoveCursorDown]: {
    mac: [[Keys.ArrowDown]],
    windows: [[Keys.ArrowDown]],
  },
  [Action.JumpCursorContentBottom]: {
    mac: [[MacModifiers.Cmd, Keys.ArrowDown]],
    windows: [[WindowsModifiers.Ctrl, Keys.ArrowDown]],
  },
  [Action.ExpandSelectionDown]: {
    mac: [[MacModifiers.Shift, Keys.ArrowDown]],
    windows: [[WindowsModifiers.Shift, Keys.ArrowDown]],
  },
  [Action.ExpandSelectionContentBottom]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.ArrowDown]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.ArrowDown]],
  },
  [Action.MoveCursorLeft]: {
    mac: [[Keys.ArrowLeft]],
    windows: [[Keys.ArrowLeft]],
  },
  [Action.JumpCursorContentLeft]: {
    mac: [[MacModifiers.Cmd, Keys.ArrowLeft]],
    windows: [[WindowsModifiers.Ctrl, Keys.ArrowLeft]],
  },
  [Action.ExpandSelectionLeft]: {
    mac: [[MacModifiers.Shift, Keys.ArrowLeft]],
    windows: [[WindowsModifiers.Shift, Keys.ArrowLeft]],
  },
  [Action.ExpandSelectionContentLeft]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.ArrowLeft]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.ArrowLeft]],
  },
  [Action.MoveCursorRight]: {
    mac: [[Keys.ArrowRight]],
    windows: [[Keys.ArrowRight]],
  },
  [Action.JumpCursorContentRight]: {
    mac: [[MacModifiers.Cmd, Keys.ArrowRight]],
    windows: [[WindowsModifiers.Ctrl, Keys.ArrowRight]],
  },
  [Action.ExpandSelectionRight]: {
    mac: [[MacModifiers.Shift, Keys.ArrowRight]],
    windows: [[WindowsModifiers.Shift, Keys.ArrowRight]],
  },
  [Action.ExpandSelectionContentRight]: {
    mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.ArrowRight]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.ArrowRight]],
  },
  [Action.GotoA1]: {
    mac: [[MacModifiers.Cmd, Keys.Home]],
    windows: [[WindowsModifiers.Ctrl, Keys.Home]],
  },
  [Action.GotoBottomRight]: {
    mac: [[MacModifiers.Cmd, Keys.End]],
    windows: [[WindowsModifiers.Ctrl, Keys.End]],
  },
  [Action.GotoRowStart]: {
    mac: [[Keys.Home]],
    windows: [[Keys.Home]],
  },
  [Action.GotoRowEnd]: {
    mac: [[Keys.End]],
    windows: [[Keys.End]],
  },
  [Action.PageUp]: {
    mac: [[Keys.PageUp]],
    windows: [[Keys.PageUp]],
  },
  [Action.PageDown]: {
    mac: [[Keys.PageDown]],
    windows: [[Keys.PageDown]],
  },
  [Action.MoveCursorRightWithSelection]: {
    mac: [[Keys.Tab]],
    windows: [[Keys.Tab]],
  },
  [Action.MoveCursorLeftWithSelection]: {
    mac: [[MacModifiers.Shift, Keys.Tab]],
    windows: [[WindowsModifiers.Shift, Keys.Tab]],
  },
  [Action.EditCell]: {
    mac: [[Keys.Enter], [MacModifiers.Shift, Keys.Enter]],
    windows: [[Keys.Enter], [WindowsModifiers.Shift, Keys.Enter]],
  },
  [Action.ToggleArrowMode]: {
    mac: [[Keys.F2]],
    windows: [[Keys.F2]],
  },
  [Action.DeleteCell]: {
    mac: [[Keys.Backspace], [Keys.Delete]],
    windows: [[Keys.Backspace], [Keys.Delete]],
  },
  [Action.ShowCellTypeMenu]: {
    mac: [[Keys.Slash], [MacModifiers.Shift, Keys.Slash]],
    windows: [[Keys.Slash], [WindowsModifiers.Shift, Keys.Slash]],
  },
  [Action.CloseInlineEditor]: {
    mac: [[Keys.Escape]],
    windows: [[Keys.Escape]],
  },
  [Action.SaveInlineEditor]: {
    mac: [[Keys.Enter], [MacModifiers.Cmd, Keys.Enter]],
    windows: [[Keys.Enter], [WindowsModifiers.Ctrl, Keys.Enter]],
  },
  [Action.SaveInlineEditorMoveUp]: {
    mac: [[MacModifiers.Shift, Keys.Enter]],
    windows: [[WindowsModifiers.Shift, Keys.Enter]],
  },
  [Action.SaveInlineEditorMoveRight]: {
    mac: [[Keys.Tab]],
    windows: [[Keys.Tab]],
  },
  [Action.SaveInlineEditorMoveLeft]: {
    mac: [[MacModifiers.Shift, Keys.Tab]],
    windows: [[WindowsModifiers.Shift, Keys.Tab]],
  },
  [Action.RemoveInsertedCells]: {
    mac: [[Keys.Backspace]],
    windows: [[Keys.Backspace]],
  },
  [Action.TriggerCell]: {
    mac: [[Keys.Space]],
    windows: [[Keys.Space]],
  },
  [Action.InsertToday]: {
    mac: [[MacModifiers.Cmd, Keys.Semicolon]],
    windows: [[WindowsModifiers.Ctrl, Keys.Semicolon]],
  },
  [Action.InsertTodayTime]: {
    mac: [[MacModifiers.Ctrl, Keys.Semicolon]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.Semicolon]],
  },
  [Action.ToggleAIAnalyst]: {
    mac: [[MacModifiers.Cmd, Keys.K]],
    windows: [[WindowsModifiers.Ctrl, Keys.K]],
  },
  [Action.SelectPageDown]: {
    mac: [[MacModifiers.Shift, Keys.PageDown]],
    windows: [[WindowsModifiers.Shift, Keys.PageDown]],
  },
  [Action.SelectPageUp]: {
    mac: [[MacModifiers.Shift, Keys.PageUp]],
    windows: [[WindowsModifiers.Shift, Keys.PageUp]],
  },
  [Action.GridToDataTable]: {
    mac: [[MacModifiers.Ctrl, Keys.T]],
    windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Alt, Keys.T]],
  },
  [Action.SelectGotoRowStart]: {
    mac: [[MacModifiers.Shift, Keys.Home]],
    windows: [[WindowsModifiers.Shift, Keys.Home]],
  },
  [Action.SelectGotoRowEnd]: {
    mac: [[MacModifiers.Shift, Keys.End]],
    windows: [[WindowsModifiers.Shift, Keys.End]],
  },
};
