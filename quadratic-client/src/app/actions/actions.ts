export enum Action {
  FileShare = 'file_share',
  FileRename = 'file_rename',
  InsertCodePython = 'insert_code_python',
  InsertCodeJavascript = 'insert_code_javascript',
  InsertCodeFormula = 'insert_code_formula',
  InsertSheet = 'insert_sheet',
  InsertChartPython = 'insert_chart_python',
  InsertChartJavascript = 'insert_chart_javascript',
  InsertApiRequestJavascript = 'insert_api_request_javascript',
  InsertApiRequestPython = 'insert_api_request_python',
  InsertCheckbox = 'insert_checkbox',
  InsertDropdown = 'insert_dropdown',
  Copy = 'copy',
  Cut = 'cut',
  Paste = 'paste',
  PasteValuesOnly = 'paste_values_only',
  PasteFormattingOnly = 'paste_formatting_only',
  FindInCurrentSheet = 'find_in_current_sheet',
  FindInAllSheets = 'find_in_all_sheets',
  HelpContactUs = 'help_contact_us',
  HelpDocs = 'help_docs',
  HelpFeedback = 'help_feedback',
  FormatAlignHorizontalCenter = 'format_align_horizontal_center',
  FormatAlignHorizontalLeft = 'format_align_horizontal_left',
  FormatAlignHorizontalRight = 'format_align_horizontal_right',
  FormatAlignVerticalBottom = 'format_align_vertical_bottom',
  FormatAlignVerticalMiddle = 'format_align_vertical_middle',
  FormatAlignVerticalTop = 'format_align_vertical_top',
  FormatNumberAutomatic = 'format_number_automatic',
  FormatNumberCurrency = 'format_number_currency',
  FormatNumberDecimalDecrease = 'format_number_decimal_decrease',
  FormatNumberDecimalIncrease = 'format_number_decimal_increase',
  FormatNumberPercent = 'format_number_percent',
  FormatNumberScientific = 'format_number_scientific',
  FormatNumberToggleCommas = 'format_number_toggle_commas',
  FormatTextWrapClip = 'format_text_wrap_clip',
  FormatTextWrapOverflow = 'format_text_wrap_overflow',
  FormatTextWrapWrap = 'format_text_wrap_wrap',
  FormatTextColor = 'format_text_color',
  FormatFillColor = 'format_fill_color',
  FormatBorderAll = 'format_border_all',
  FormatBorderOuter = 'format_border_outer',
  FormatBorderInner = 'format_border_inner',
  FormatBorderVertical = 'format_border_vertical',
  FormatBorderHorizontal = 'format_border_horizontal',
  FormatBorderLeft = 'format_border_left',
  FormatBorderRight = 'format_border_right',
  FormatBorderTop = 'format_border_top',
  FormatBorderBottom = 'format_border_bottom',
  FormatBorderClear = 'format_border_clear',
  FormatBorderLine1 = 'format_border_line1',
  FormatBorderLine2 = 'format_border_line2',
  FormatBorderLine3 = 'format_border_line3',
  FormatBorderDashed = 'format_border_dashed',
  FormatBorderDotted = 'format_border_dotted',
  FormatBorderDouble = 'format_border_double',
  FormatBorderColor = 'format_border_color',
  GridPanMode = 'grid_pan_mode',
  ShowCommandPalette = 'show_command_palette',
  TogglePresentationMode = 'toggle_presentation_mode',
  CloseOverlay = 'close_overlay',
  ShowGoToMenu = 'show_go_to_menu',
  ZoomIn = 'zoom_in',
  ZoomOut = 'zoom_out',
  ZoomToSelection = 'zoom_to_selection',
  ZoomToFit = 'zoom_to_fit',
  ZoomTo50 = 'zoom_to_50',
  ZoomTo100 = 'zoom_to_100',
  ZoomTo200 = 'zoom_to_200',
  Save = 'save',
  SwitchSheetNext = 'switch_sheet_next',
  SwitchSheetPrevious = 'switch_sheet_previous',
  ClearFormattingBorders = 'clear_formatting_borders',
  ToggleBold = 'toggle_bold',
  ToggleItalic = 'toggle_italic',
  FillRight = 'fill_right',
  FillDown = 'fill_down',
  CancelExecution = 'cancel_execution',
  CopyAsPng = 'copy_as_png',
  DownloadAsCsv = 'download_as_csv',
  Undo = 'undo',
  Redo = 'redo',
  SelectAll = 'select_all',
  SelectColumn = 'select_column',
  SelectRow = 'select_row',
  ExecuteCode = 'execute_code',
  RerunSheetCode = 'rerun_sheet_code',
  RerunAllCode = 'rerun_all_code',
  InsertCellReference = 'insert_cell_reference',
  MoveCursorUp = 'move_cursor_up',
  JumpCursorContentTop = 'jump_cursor_content_top',
  ExpandSelectionUp = 'expand_selection_up',
  ExpandSelectionContentTop = 'expand_selection_content_top',
  MoveCursorDown = 'move_cursor_down',
  JumpCursorContentBottom = 'jump_cursor_content_bottom',
  ExpandSelectionDown = 'expand_selection_down',
  ExpandSelectionContentBottom = 'expand_selection_content_bottom',
  MoveCursorLeft = 'move_cursor_left',
  JumpCursorContentLeft = 'jump_cursor_content_left',
  ExpandSelectionLeft = 'expand_selection_left',
  ExpandSelectionContentLeft = 'expand_selection_content_left',
  MoveCursorRight = 'move_cursor_right',
  JumpCursorContentRight = 'jump_cursor_content_right',
  ExpandSelectionRight = 'expand_selection_right',
  ExpandSelectionContentRight = 'expand_selection_content_right',
  GotoA0 = 'goto_A0',
  GotoBottomRight = 'goto_bottom_right',
  GotoRowStart = 'goto_row_start',
  GotoRowEnd = 'goto_row_end',
  PageUp = 'page_up',
  PageDown = 'page_down',
  MoveCursorRightWithSelection = 'move_cursor_right_with_selection',
  MoveCursorLeftWithSelection = 'move_cursor_left_with_selection',
  EditCell = 'edit_cell',
  DeleteCell = 'delete_cell',
  ShowCellTypeMenu = 'show_cell_type_menu',
  CloseInlineEditor = 'close_inline_editor',
  SaveInlineEditor = 'save_inline_editor',
  SaveInlineEditorMoveUp = 'save_inline_editor_move_up',
  SaveInlineEditorMoveRight = 'save_inline_editor_move_right',
  SaveInlineEditorMoveLeft = 'save_inline_editor_move_left',
  RemoveInsertedCells = 'remove_inserted_cells',
  TriggerCell = 'trigger_cell',
}