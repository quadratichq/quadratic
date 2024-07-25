/**
 * Default shortcuts for the application.
 * Mac key names are used for the combinations.
 */
export const defaultShortcuts = {
  // QuadraticGrid.tsx
  grid_pan_mode: ['Space'],

  // keyboardViewport.ts
  show_command_palette: ['Cmd + P', 'Cmd + /'],
  toggle_presentation_mode: ['Cmd + .'],
  close_overlay: ['Escape'],
  show_go_to_menu: ['Cmd + G', 'Cmd + J'],
  zoom_in: ['Cmd + ='],
  zoom_out: ['Cmd + -'],
  zoom_to_selection: ['Cmd + 8'],
  zoom_to_fit: ['Cmd + 9'],
  zoom_to_100: ['Cmd + 0'],
  save: ['Cmd + S'],
  switch_sheet_next: ['Cmd + Shift + PageUp', 'Cmd + Alt + PageUp', 'Alt + ArrowUp', 'Alt + ArrowRight'],
  switch_sheet_previous: ['Cmd + Shift + PageDown', 'Cmd + Alt + PageDown', 'Alt + ArrowDown', 'Alt + ArrowLeft'],
  clear_formatting_borders: ['Cmd + \\'],
  toggle_bold: ['Cmd + B'],
  toggle_italic: ['Cmd + I'],
  fill_right: ['Cmd + R'],
  fill_down: ['Cmd + D'],
  cancel_execution: ['Cmd + Escape'],

  // keyboardSearch.ts
  show_search: ['Cmd + F'],

  // keyboardClipboard.ts
  copy_as_png: ['Cmd + Shift + C'],
  download_as_csv: ['Cmd + Shift + E'],

  // keyboardUndoRedo.ts
  undo: ['Cmd + Z'],
  redo: ['Cmd + Shift + Z', 'Cmd + Y'],

  // keyboardSelect.ts
  select_all: ['Cmd + A', 'Cmd + Shift + Space'],
  select_column: ['Cmd + Space'],
  select_row: ['Shift + Space'],

  // keyboardCode.ts
  execute_code: ['Cmd + Enter'],
  rerun_sheet_code: ['Cmd + Shift + Alt + Enter'],
  rerun_all_code: ['Cmd + Shift + Enter'],
  insert_cell_reference: ['Cmd + L'],

  // keyboardPosition.ts
  move_cursor_up: ['ArrowUp'],
  jump_cursor_content_top: ['Cmd + ArrowUp'],
  expand_selection_up: ['Shift + ArrowUp'],
  expand_selection_content_top: ['Cmd + Shift + ArrowUp'],
  move_cursor_down: ['ArrowDown'],
  jump_cursor_content_bottom: ['Cmd + ArrowDown'],
  expand_selection_down: ['Shift + ArrowDown'],
  expand_selection_content_bottom: ['Cmd + Shift + ArrowDown'],
  move_cursor_left: ['ArrowLeft'],
  jump_cursor_content_left: ['Cmd + ArrowLeft'],
  expand_selection_left: ['Shift + ArrowLeft'],
  expand_selection_content_left: ['Cmd + Shift + ArrowLeft'],
  move_cursor_right: ['ArrowRight'],
  jump_cursor_content_right: ['Cmd + ArrowRight'],
  expand_selection_right: ['Shift + ArrowRight'],
  expand_selection_content_right: ['Cmd + Shift + ArrowRight'],
  goto_A0: ['Cmd + Home'],
  goto_bottom_right: ['Cmd + End'],
  goto_row_start: ['Home'],
  goto_row_end: ['End'],
  page_up: ['PageUp'],
  page_down: ['PageDown'],

  // keyboardCell.ts
  move_cursor_right_with_selection: ['Tab'],
  move_cursor_left_with_selection: ['Shift + Tab'],
  edit_cell: ['Enter', 'F2'],
  delete_cell: ['Backspace', 'Delete'],
  show_code_editor: ['/'],

  // InlineEditorKeyboard.ts
  close_inline_editor: ['Escape'],
  save_inline_editor: ['Enter'],
  save_inline_editor_move_right: ['Tab'],
  save_inline_editor_move_left: ['Shift + Tab'],
  remove_inserted_cells: ['Backspace'],
};
