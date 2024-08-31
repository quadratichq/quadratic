import { Shortcuts } from './schema';

export const defaultShortcuts: Shortcuts = [
  // QuadraticGrid.tsx
  {
    action: 'grid_pan_mode',
    shortcuts: {
      mac: ['Space'],
      windows: ['Space'],
    },
  },

  // keyboardViewport.ts
  {
    action: 'show_command_palette',
    shortcuts: {
      mac: ['Cmd + P', 'Cmd + /'],
      windows: ['Ctrl + P', 'Ctrl + /'],
    },
  },
  {
    action: 'toggle_presentation_mode',
    shortcuts: {
      mac: ['Cmd + .'],
      windows: ['Ctrl + .'],
    },
  },
  {
    action: 'close_overlay',
    shortcuts: {
      mac: ['Escape'],
      windows: ['Escape'],
    },
  },
  {
    action: 'show_go_to_menu',
    shortcuts: {
      mac: ['Cmd + G', 'Cmd + J'],
      windows: ['Ctrl + G', 'Ctrl + J'],
    },
  },
  {
    action: 'zoom_in',
    shortcuts: {
      mac: ['Cmd + ='],
      windows: ['Ctrl + ='],
    },
  },
  {
    action: 'zoom_out',
    shortcuts: {
      mac: ['Cmd + -'],
      windows: ['Ctrl + -'],
    },
  },
  {
    action: 'zoom_to_selection',
    shortcuts: {
      mac: ['Cmd + 8'],
      windows: ['Ctrl + 8'],
    },
  },
  {
    action: 'zoom_to_fit',
    shortcuts: {
      mac: ['Cmd + 9'],
      windows: ['Ctrl + 9'],
    },
  },
  {
    action: 'zoom_to_100',
    shortcuts: {
      mac: ['Cmd + 0'],
      windows: ['Ctrl + 0'],
    },
  },
  {
    action: 'save',
    shortcuts: {
      mac: ['Cmd + S'],
      windows: ['Ctrl + S'],
    },
  },
  {
    action: 'switch_sheet_next',
    shortcuts: {
      mac: ['Cmd + Shift + PageUp', 'Cmd + Alt + PageUp', 'Alt + ArrowUp', 'Alt + ArrowRight'],
      windows: ['Ctrl + Shift + PageUp', 'Ctrl + Alt + PageUp', 'Alt + ArrowUp', 'Alt + ArrowRight'],
    },
  },
  {
    action: 'switch_sheet_previous',
    shortcuts: {
      mac: ['Cmd + Shift + PageDown', 'Cmd + Alt + PageDown', 'Alt + ArrowDown', 'Alt + ArrowLeft'],
      windows: ['Ctrl + Shift + PageDown', 'Ctrl + Alt + PageDown', 'Alt + ArrowDown', 'Alt + ArrowLeft'],
    },
  },
  {
    action: 'clear_formatting_borders',
    shortcuts: {
      mac: ['Cmd + \\'],
      windows: ['Ctrl + \\'],
    },
  },
  {
    action: 'toggle_bold',
    shortcuts: {
      mac: ['Cmd + B'],
      windows: ['Ctrl + B'],
    },
  },
  {
    action: 'toggle_italic',
    shortcuts: {
      mac: ['Cmd + I'],
      windows: ['Ctrl + I'],
    },
  },
  {
    action: 'toggle_underline',
    shortcuts: {
      mac: ['Cmd + U'],
      windows: ['Ctrl + U'],
    },
  },
  {
    action: 'toggle_strike_through',
    shortcuts: {
      mac: ['Cmd + 5'],
      windows: ['Ctrl + 5'],
    },
  },
  {
    action: 'fill_right',
    shortcuts: {
      mac: ['Cmd + R'],
      windows: ['Ctrl + R'],
    },
  },
  {
    action: 'fill_down',
    shortcuts: {
      mac: ['Cmd + D'],
      windows: ['Ctrl + D'],
    },
  },
  {
    action: 'cancel_execution',
    shortcuts: {
      mac: ['Cmd + Escape'],
      windows: ['Ctrl + Escape'],
    },
  },

  // keyboardSearch.ts
  {
    action: 'show_search',
    shortcuts: {
      mac: ['Cmd + F'],
      windows: ['Ctrl + F'],
    },
  },

  // keyboardClipboard.ts
  {
    action: 'copy_as_png',
    shortcuts: {
      mac: ['Cmd + Shift + C'],
      windows: ['Ctrl + Shift + C'],
    },
  },
  {
    action: 'download_as_csv',
    shortcuts: {
      mac: ['Cmd + Shift + E'],
      windows: ['Ctrl + Shift + E'],
    },
  },

  // keyboardUndoRedo.ts
  {
    action: 'undo',
    shortcuts: {
      mac: ['Cmd + Z'],
      windows: ['Ctrl + Z'],
    },
  },
  {
    action: 'redo',
    shortcuts: {
      mac: ['Cmd + Shift + Z', 'Cmd + Y'],
      windows: ['Ctrl + Shift + Z', 'Ctrl + Y'],
    },
  },

  // keyboardSelect.ts
  {
    action: 'select_all',
    shortcuts: {
      mac: ['Cmd + A', 'Cmd + Shift + Space'],
      windows: ['Ctrl + A', 'Ctrl + Shift + Space'],
    },
  },
  {
    action: 'select_column',
    shortcuts: {
      mac: ['Cmd + Space'],
      windows: ['Ctrl + Space'],
    },
  },
  {
    action: 'select_row',
    shortcuts: {
      mac: ['Shift + Space'],
      windows: ['Shift + Space'],
    },
  },

  // keyboardCode.ts
  {
    action: 'execute_code',
    shortcuts: {
      mac: ['Cmd + Enter'],
      windows: ['Ctrl + Enter'],
    },
  },
  {
    action: 'rerun_sheet_code',
    shortcuts: {
      mac: ['Cmd + Shift + Alt + Enter'],
      windows: ['Ctrl + Shift + Alt + Enter'],
    },
  },
  {
    action: 'rerun_all_code',
    shortcuts: {
      mac: ['Cmd + Shift + Enter'],
      windows: ['Ctrl + Shift + Enter'],
    },
  },
  {
    action: 'insert_cell_reference',
    shortcuts: {
      mac: ['Cmd + L'],
      windows: ['Ctrl + L'],
    },
  },

  // keyboardPosition.ts
  {
    action: 'move_cursor_up',
    shortcuts: {
      mac: ['ArrowUp'],
      windows: ['ArrowUp'],
    },
  },
  {
    action: 'jump_cursor_content_top',
    shortcuts: {
      mac: ['Cmd + ArrowUp'],
      windows: ['Ctrl + ArrowUp'],
    },
  },
  {
    action: 'expand_selection_up',
    shortcuts: {
      mac: ['Shift + ArrowUp'],
      windows: ['Shift + ArrowUp'],
    },
  },
  {
    action: 'expand_selection_content_top',
    shortcuts: {
      mac: ['Cmd + Shift + ArrowUp'],
      windows: ['Ctrl + Shift + ArrowUp'],
    },
  },
  {
    action: 'move_cursor_down',
    shortcuts: {
      mac: ['ArrowDown'],
      windows: ['ArrowDown'],
    },
  },
  {
    action: 'jump_cursor_content_bottom',
    shortcuts: {
      mac: ['Cmd + ArrowDown'],
      windows: ['Ctrl + ArrowDown'],
    },
  },
  {
    action: 'expand_selection_down',
    shortcuts: {
      mac: ['Shift + ArrowDown'],
      windows: ['Shift + ArrowDown'],
    },
  },
  {
    action: 'expand_selection_content_bottom',
    shortcuts: {
      mac: ['Cmd + Shift + ArrowDown'],
      windows: ['Ctrl + Shift + ArrowDown'],
    },
  },
  {
    action: 'move_cursor_left',
    shortcuts: {
      mac: ['ArrowLeft'],
      windows: ['ArrowLeft'],
    },
  },
  {
    action: 'jump_cursor_content_left',
    shortcuts: {
      mac: ['Cmd + ArrowLeft'],
      windows: ['Ctrl + ArrowLeft'],
    },
  },
  {
    action: 'expand_selection_left',
    shortcuts: {
      mac: ['Shift + ArrowLeft'],
      windows: ['Shift + ArrowLeft'],
    },
  },
  {
    action: 'expand_selection_content_left',
    shortcuts: {
      mac: ['Cmd + Shift + ArrowLeft'],
      windows: ['Ctrl + Shift + ArrowLeft'],
    },
  },
  {
    action: 'move_cursor_right',
    shortcuts: {
      mac: ['ArrowRight'],
      windows: ['ArrowRight'],
    },
  },
  {
    action: 'jump_cursor_content_right',
    shortcuts: {
      mac: ['Cmd + ArrowRight'],
      windows: ['Ctrl + ArrowRight'],
    },
  },
  {
    action: 'expand_selection_right',
    shortcuts: {
      mac: ['Shift + ArrowRight'],
      windows: ['Shift + ArrowRight'],
    },
  },
  {
    action: 'expand_selection_content_right',
    shortcuts: {
      mac: ['Cmd + Shift + ArrowRight'],
      windows: ['Ctrl + Shift + ArrowRight'],
    },
  },
  {
    action: 'goto_A0',
    shortcuts: {
      mac: ['Cmd + Home'],
      windows: ['Ctrl + Home'],
    },
  },
  {
    action: 'goto_bottom_right',
    shortcuts: {
      mac: ['Cmd + End'],
      windows: ['Ctrl + End'],
    },
  },
  {
    action: 'goto_row_start',
    shortcuts: {
      mac: ['Home'],
      windows: ['Home'],
    },
  },
  {
    action: 'goto_row_end',
    shortcuts: {
      mac: ['End'],
      windows: ['End'],
    },
  },
  {
    action: 'page_up',
    shortcuts: {
      mac: ['PageUp'],
      windows: ['PageUp'],
    },
  },
  {
    action: 'page_down',
    shortcuts: {
      mac: ['PageDown'],
      windows: ['PageDown'],
    },
  },

  // keyboardCell.ts
  {
    action: 'move_cursor_right_with_selection',
    shortcuts: {
      mac: ['Tab'],
      windows: ['Tab'],
    },
  },
  {
    action: 'move_cursor_left_with_selection',
    shortcuts: {
      mac: ['Shift + Tab'],
      windows: ['Shift + Tab'],
    },
  },
  {
    action: 'edit_cell',
    shortcuts: {
      mac: ['Enter', 'Shift + Enter', 'F2'],
      windows: ['Enter', 'Shift + Enter', 'F2'],
    },
  },
  {
    action: 'delete_cell',
    shortcuts: {
      mac: ['Backspace', 'Delete'],
      windows: ['Backspace', 'Delete'],
    },
  },
  {
    action: 'show_cell_type_menu',
    shortcuts: {
      mac: ['/', 'Shift + /'],
      windows: ['/', 'Shift + /'],
    },
  },

  // InlineEditorKeyboard.ts
  {
    action: 'close_inline_editor',
    shortcuts: {
      mac: ['Escape'],
      windows: ['Escape'],
    },
  },
  {
    action: 'save_inline_editor',
    shortcuts: {
      mac: ['Enter', 'Cmd + Enter'],
      windows: ['Enter', 'Ctrl + Enter'],
    },
  },
  {
    action: 'save_inline_editor_move_up',
    shortcuts: {
      mac: ['Shift + Enter'],
      windows: ['Shift + Enter'],
    },
  },
  {
    action: 'save_inline_editor_move_right',
    shortcuts: {
      mac: ['Tab'],
      windows: ['Tab'],
    },
  },
  {
    action: 'save_inline_editor_move_left',
    shortcuts: {
      mac: ['Shift + Tab'],
      windows: ['Shift + Tab'],
    },
  },
  {
    action: 'remove_inserted_cells',
    shortcuts: {
      mac: ['Backspace'],
      windows: ['Backspace'],
    },
  },
  {
    action: 'trigger_cell',
    shortcuts: {
      mac: ['Space'],
      windows: ['Space'],
    },
  },

  // PointerLink.ts
  {
    action: 'open_link',
    shortcuts: {
      mac: ['Cmd + Click'],
      windows: ['Ctrl + Click'],
    },
  },
];
