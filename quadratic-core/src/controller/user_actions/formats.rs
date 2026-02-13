//! This module contains the implementation for changing formats within the
//! Grid. These functions use the newer Operation::SetCellFormatsSelection,
//! which provide formats for a user-defined selection.

use wasm_bindgen::JsValue;

use crate::Pos;
use crate::Rect;
use crate::a1::{A1Selection, CellRefRange};
use crate::controller::GridController;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::operations::operation::Operation;
use crate::grid::DataTable;
use crate::grid::SheetId;
use crate::grid::formats::{FormatUpdate, SheetFormatUpdates};
use crate::grid::{CellAlign, CellVerticalAlign, CellWrap, NumericFormat, NumericFormatKind};

/// Handles format migration for single-value tables.
///
/// For single-value tables, formatting is applied to the sheet instead of the table
/// to avoid issues with format merging. If the table has existing formats, they are
/// migrated to the sheet and combined with the new format, then the table formats
/// are cleared.
///
/// Returns `true` if the table was handled as a single-value table (caller should continue).
fn handle_single_value_table_format(
    data_table: &DataTable,
    data_table_pos: Pos,
    format_update: FormatUpdate,
    sheet_id: SheetId,
    sheet_format_update: &mut SheetFormatUpdates,
    ops: &mut Vec<Operation>,
) -> bool {
    if !data_table.is_single_value() {
        return false;
    }

    if data_table.formats.is_some() {
        let existing_table_format = data_table.get_format(pos![A1]);
        // Combine new format with existing table format (new values take precedence where set, existing values preserved otherwise)
        let combined_format: FormatUpdate = format_update.combine(&existing_table_format.into());
        sheet_format_update.set_format_cell(data_table_pos, combined_format);

        // Clear the table formats since we've migrated them to the sheet
        let table_format_updates = SheetFormatUpdates::from_selection(
            &A1Selection::from_rect(Rect::single_pos(pos![A1]).to_sheet_rect(sheet_id)),
            FormatUpdate::cleared(),
        );
        ops.push(Operation::DataTableFormats {
            sheet_pos: data_table_pos.to_sheet_pos(sheet_id),
            formats: table_format_updates,
        });
    } else {
        // No existing table formats, just apply to sheet
        sheet_format_update.set_format_cell(data_table_pos, format_update);
    }

    true
}

impl GridController {
    pub(crate) fn clear_format_borders(
        &mut self,
        selection: &A1Selection,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.clear_format_borders_operations(selection, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
    }

    /// Separately apply sheet and table formats.
    ///
    /// If `skip_richtext_clearing` is true, the function will not generate
    /// operations to clear RichText inline formatting. This should be set to
    /// true when the cells are being deleted (since there's no point in
    /// clearing formatting on cells that will be removed).
    pub(crate) fn format_ops(
        &self,
        selection: &A1Selection,
        format_update: FormatUpdate,
        ignore_tables_having_anchoring_cell_in_selection: bool,
        skip_richtext_clearing: bool,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return ops;
        };

        // Expand selection to include full merged cell rects for all format operations
        // This ensures formatting is applied to all cells within merged cells
        let expanded_selection = selection.expand_to_include_merge_rects(&sheet.merge_cells);

        let mut sheet_format_update =
            SheetFormatUpdates::from_selection(&expanded_selection, format_update.clone());

        for range in expanded_selection.ranges.iter() {
            match range {
                CellRefRange::Sheet { range } => {
                    let rect = range.to_rect_unbounded();
                    for (output_rect, intersection_rect, data_table) in
                        sheet.iter_data_tables_intersects_rect(rect)
                    {
                        let data_table_pos = output_rect.min;

                        if ignore_tables_having_anchoring_cell_in_selection
                            && intersection_rect.contains(data_table_pos)
                        {
                            continue;
                        }

                        // For single-value tables, apply formatting to the sheet instead of the table
                        let cell_format_update = sheet_format_update.format_update(data_table_pos);
                        if handle_single_value_table_format(
                            data_table,
                            data_table_pos,
                            cell_format_update,
                            selection.sheet_id,
                            &mut sheet_format_update,
                            &mut ops,
                        ) {
                            continue;
                        }

                        let table_format_updates = data_table
                            .transfer_formats_from_sheet_format_updates(
                                data_table_pos,
                                intersection_rect,
                                &mut sheet_format_update,
                            );

                        sheet_format_update
                            .set_format_rect(intersection_rect, FormatUpdate::cleared());

                        if let Some(table_format_updates) = table_format_updates
                            && !table_format_updates.is_default()
                        {
                            ops.push(Operation::DataTableFormats {
                                sheet_pos: data_table_pos.to_sheet_pos(expanded_selection.sheet_id),
                                formats: table_format_updates,
                            });
                        }
                    }
                }
                CellRefRange::Table { range } => {
                    let Some(table) = self.a1_context().try_table(&range.table_name) else {
                        continue;
                    };

                    let data_table_pos = table.bounds.min;

                    let Some(data_table) = sheet.data_table_at(&data_table_pos) else {
                        continue;
                    };

                    // For single-value tables, apply formatting to the sheet instead of the table
                    if handle_single_value_table_format(
                        data_table,
                        data_table_pos,
                        format_update.clone(),
                        selection.sheet_id,
                        &mut sheet_format_update,
                        &mut ops,
                    ) {
                        continue;
                    }

                    let y_adjustment = data_table.y_adjustment(true);

                    if let Some(sheet_range) =
                        range.convert_to_ref_range_bounds(true, self.a1_context(), false, true)
                    {
                        let table_range = sheet_range.translate_unchecked(
                            1 - data_table_pos.x,
                            1 - data_table_pos.y - y_adjustment,
                        );

                        let mut format_rect = table_range.to_rect_unbounded();

                        if let Some(column_headers) = &data_table.column_headers {
                            for column_header in column_headers.iter() {
                                if !column_header.display {
                                    let column_index = column_header.value_index as i64;
                                    if column_index < format_rect.min.x {
                                        format_rect.min.x += 1;
                                    }
                                    if column_index < format_rect.max.x {
                                        format_rect.max.x += 1;
                                    }
                                }
                            }
                        }

                        let table_format_updates = SheetFormatUpdates::from_selection(
                            &A1Selection::from_rect(
                                format_rect.to_sheet_rect(expanded_selection.sheet_id),
                            ),
                            format_update.clone(),
                        );

                        if !table_format_updates.is_default() {
                            ops.push(Operation::DataTableFormats {
                                sheet_pos: data_table_pos.to_sheet_pos(expanded_selection.sheet_id),
                                formats: table_format_updates,
                            });
                        }
                    }
                }
            }
        }

        if !sheet_format_update.is_default() {
            // Add operations to clear RichText inline formatting when cell-level
            // formatting is being SET. Skip this when cells are being deleted
            // since there's no point in clearing formatting on deleted cells,
            // and doing so would overwrite the deletion with a modified RichText.
            if !skip_richtext_clearing {
                let richtext_ops =
                    sheet.get_richtext_format_clearing_operations(&sheet_format_update);
                ops.extend(richtext_ops);
            }

            ops.push(Operation::SetCellFormatsA1 {
                sheet_id: expanded_selection.sheet_id,
                formats: sheet_format_update,
            });
        }

        ops
    }

    pub(crate) fn set_align(
        &mut self,
        selection: &A1Selection,
        align: CellAlign,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            align: Some(Some(align)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_vertical_align(
        &mut self,
        selection: &A1Selection,
        vertical_align: CellVerticalAlign,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            vertical_align: Some(Some(vertical_align)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_bold(
        &mut self,
        selection: &A1Selection,
        bold: Option<bool>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let bold = match bold {
            Some(bold) => bold,
            None => {
                let sheet = self
                    .try_sheet(selection.sheet_id)
                    .ok_or(JsValue::UNDEFINED)?;
                let format = sheet.cell_format(selection.cursor);
                !format.bold.unwrap_or(false)
            }
        };

        let format_update = FormatUpdate {
            bold: Some(Some(bold)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_italic(
        &mut self,
        selection: &A1Selection,
        italic: Option<bool>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let italic = match italic {
            Some(italic) => italic,
            None => {
                let sheet = self
                    .try_sheet(selection.sheet_id)
                    .ok_or(JsValue::UNDEFINED)?;
                let format = sheet.cell_format(selection.cursor);
                !format.italic.unwrap_or(false)
            }
        };

        let format_update = FormatUpdate {
            italic: Some(Some(italic)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_font_size(
        &mut self,
        selection: &A1Selection,
        font_size: i16,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            font_size: Some(Some(font_size)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_cell_wrap(
        &mut self,
        selection: &A1Selection,
        wrap: CellWrap,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            wrap: Some(Some(wrap)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    /// Changes the Selection to use a currency format and updates the decimals
    /// to 2.
    pub(crate) fn set_currency(
        &mut self,
        selection: &A1Selection,
        symbol: String,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return Err("Sheet not found".into());
        };
        let format = sheet.format_selection(selection, self.a1_context());
        let (kind, symbol): (NumericFormatKind, Option<String>) = if format
            .numeric_format
            .is_some_and(|f| f.symbol == Some(symbol.clone()))
        {
            (NumericFormatKind::Number, None)
        } else {
            (NumericFormatKind::Currency, Some(symbol))
        };
        let format_update = FormatUpdate {
            numeric_format: Some(Some(NumericFormat { kind, symbol })),
            numeric_decimals: Some(Some(2)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_numeric_format(
        &mut self,
        selection: &A1Selection,
        kind: NumericFormatKind,
        symbol: Option<String>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return Err("Sheet not found".into());
        };
        let format = sheet.format_selection(selection, self.a1_context());
        let kind = if format.numeric_format.is_some_and(|f| f.kind == kind) {
            NumericFormatKind::Number
        } else {
            kind
        };
        let format_update = FormatUpdate {
            numeric_format: Some(Some(NumericFormat { kind, symbol })),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_commas(
        &mut self,
        selection: &A1Selection,
        commas: Option<bool>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let commas = match commas {
            Some(commas) => commas,
            None => {
                let sheet = self
                    .try_sheet(selection.sheet_id)
                    .ok_or(JsValue::UNDEFINED)?;
                let format = sheet.cell_format(selection.cursor);
                !format.numeric_commas.unwrap_or(false)
            }
        };

        let format_update = FormatUpdate {
            numeric_commas: Some(Some(commas)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_text_color(
        &mut self,
        selection: &A1Selection,
        color: Option<String>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            text_color: Some(color),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_fill_color(
        &mut self,
        selection: &A1Selection,
        color: Option<String>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            fill_color: Some(color),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn remove_number_formatting(
        &mut self,
        selection: &A1Selection,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            numeric_format: Some(None),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn change_decimal_places(
        &mut self,
        selection: &A1Selection,
        delta: i32,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return Err("Sheet not found".into());
        };
        let kind = sheet.cell_format_numeric_kind(selection.cursor);
        let source_decimals = sheet
            .calculate_decimal_places(selection.cursor, kind)
            .unwrap_or(0);
        let new_precision = i16::max(0, source_decimals + (delta as i16));
        let format_update = FormatUpdate {
            numeric_decimals: Some(Some(new_precision)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_date_time_format(
        &mut self,
        selection: &A1Selection,
        date_time: Option<String>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            date_time: Some(date_time),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_underline(
        &mut self,
        selection: &A1Selection,
        underline: Option<bool>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let underline = match underline {
            Some(underline) => underline,
            None => {
                let sheet = self
                    .try_sheet(selection.sheet_id)
                    .ok_or(JsValue::UNDEFINED)?;
                let format = sheet.cell_format(selection.cursor);
                !format.underline.unwrap_or(false)
            }
        };

        let format_update = FormatUpdate {
            underline: Some(Some(underline)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_strike_through(
        &mut self,
        selection: &A1Selection,
        strike_through: Option<bool>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let strike_through = match strike_through {
            Some(strike_through) => strike_through,
            None => {
                let sheet = self
                    .try_sheet(selection.sheet_id)
                    .ok_or(JsValue::UNDEFINED)?;
                let format = sheet.cell_format(selection.cursor);
                !format.strike_through.unwrap_or(false)
            }
        };

        let format_update = FormatUpdate {
            strike_through: Some(Some(strike_through)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
        Ok(())
    }

    pub(crate) fn set_formats(
        &mut self,
        selection: &A1Selection,
        format_update: FormatUpdate,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.format_ops(selection, format_update, false, false);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
    }

    pub(crate) fn merge_cells(
        &mut self,
        selection: A1Selection,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.merge_cells_a1_selection_operations(selection);
        if !ops.is_empty() {
            self.start_user_ai_transaction(ops, cursor, TransactionName::SetMergeCells, is_ai);
        }
    }

    pub(crate) fn unmerge_cells(
        &mut self,
        selection: A1Selection,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.unmerge_cells_a1_selection_operations(selection);
        if !ops.is_empty() {
            self.start_user_ai_transaction(ops, cursor, TransactionName::SetMergeCells, is_ai);
        }
    }

    /// Sets multiple format updates in a single transaction.
    /// Each entry is a (selection, format_update) pair.
    pub(crate) fn set_formats_a1(
        &mut self,
        format_entries: Vec<(A1Selection, FormatUpdate)>,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let mut all_ops = vec![];
        for (selection, format_update) in format_entries {
            let ops = self.format_ops(&selection, format_update, false, false);
            all_ops.extend(ops);
        }
        self.start_user_ai_transaction(all_ops, cursor, TransactionName::SetFormats, is_ai);
    }
}

#[cfg(test)]
mod test {
    use crate::SheetPos;
    use crate::controller::GridController;
    use crate::controller::active_transactions::transaction_name::TransactionName;
    use crate::controller::operations::operation::Operation;
    use crate::grid::CellWrap;
    use crate::grid::formats::{FormatUpdate, SheetFormatUpdates};
    use crate::test_util::*;
    use crate::{Pos, a1::A1Selection};

    #[test]
    fn test_set_align_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_align(
            &A1Selection::test_a1("A1:B2"),
            crate::grid::CellAlign::Center,
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.try_format(pos![A2]).unwrap_or_default().align,
            Some(crate::grid::CellAlign::Center)
        );
    }

    #[test]
    fn test_set_vertical_align_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_vertical_align(
            &A1Selection::test_a1("A1:B2"),
            crate::grid::CellVerticalAlign::Middle,
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .vertical_align,
            Some(crate::grid::CellVerticalAlign::Middle)
        );
    }

    #[test]
    fn test_set_bold() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_bold(&A1Selection::test_a1("A1:B2"), Some(true), None, false)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.format(pos![A2]).bold, Some(true));
    }

    #[test]
    fn test_set_cell_wrap_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_wrap(&A1Selection::test_a1("A1:B2"), CellWrap::Clip, None, false)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.try_format(pos![A2]).unwrap_or_default().wrap,
            Some(CellWrap::Clip)
        );
    }

    #[test]
    fn test_set_numeric_format_currency() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = A1Selection::from_xy(1, 1, sheet_id);
        gc.set_currency(&selection, "€".to_string(), None, false)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(Pos { x: 1, y: 1 })
                .unwrap_or_default()
                .numeric_format,
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("€".to_string())
            })
        );
    }

    #[test]
    fn test_set_numeric_format_exponential() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_numeric_format(
            &A1Selection::test_a1("A1:B2"),
            crate::grid::NumericFormatKind::Exponential,
            None,
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .numeric_format,
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Exponential,
                symbol: None
            })
        );
    }

    #[test]
    fn test_set_numeric_format_percentage() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_numeric_format(
            &A1Selection::test_a1("A1:B2"),
            crate::grid::NumericFormatKind::Percentage,
            None,
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .numeric_format,
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Percentage,
                symbol: None
            })
        );
    }

    #[test]
    fn test_toggle_commas_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_commas(&A1Selection::test_a1("A1:B2"), Some(true), None, false)
            .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .numeric_commas,
            Some(true)
        );

        gc.set_commas(&A1Selection::test_a1("A1:B2"), Some(false), None, false)
            .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .numeric_commas,
            Some(false)
        );
    }

    #[test]
    fn test_set_italic_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_italic(&A1Selection::test_a1("A1:B2"), Some(true), None, false)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .italic,
            Some(true)
        );
    }

    #[test]
    fn test_set_text_color_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_text_color(
            &A1Selection::test_a1("A1:B2"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .text_color,
            Some("red".to_string())
        );
    }

    #[test]
    fn test_set_fill_color_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_fill_color(
            &A1Selection::test_a1("A1:B2"),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .fill_color,
            Some("blue".to_string())
        );
    }

    #[test]
    fn test_set_fill_color_merged_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells A1:C3
        gc.merge_cells(A1Selection::test_a1("A1:C3"), None, false);

        // Set fill color on just the anchor cell (A1)
        gc.set_fill_color(
            &A1Selection::test_a1("A1"),
            Some("green".to_string()),
            None,
            false,
        )
        .unwrap();

        {
            let sheet = gc.sheet(sheet_id);

            // All cells within the merged cell should have the fill color
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![A1])
                    .unwrap_or_default()
                    .fill_color,
                Some("green".to_string()),
                "A1 should have fill color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![B1])
                    .unwrap_or_default()
                    .fill_color,
                Some("green".to_string()),
                "B1 should have fill color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![C1])
                    .unwrap_or_default()
                    .fill_color,
                Some("green".to_string()),
                "C1 should have fill color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![A2])
                    .unwrap_or_default()
                    .fill_color,
                Some("green".to_string()),
                "A2 should have fill color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![B2])
                    .unwrap_or_default()
                    .fill_color,
                Some("green".to_string()),
                "B2 should have fill color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![C2])
                    .unwrap_or_default()
                    .fill_color,
                Some("green".to_string()),
                "C2 should have fill color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![A3])
                    .unwrap_or_default()
                    .fill_color,
                Some("green".to_string()),
                "A3 should have fill color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![B3])
                    .unwrap_or_default()
                    .fill_color,
                Some("green".to_string()),
                "B3 should have fill color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![C3])
                    .unwrap_or_default()
                    .fill_color,
                Some("green".to_string()),
                "C3 should have fill color"
            );
        }

        // Test with cursor at non-anchor position
        gc.set_fill_color(
            &A1Selection::test_a1("B2"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        // All cells should now have red fill color
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A1])
                .unwrap_or_default()
                .fill_color,
            Some("red".to_string()),
            "A1 should have red fill color after filling from B2"
        );
        assert_eq!(
            sheet
                .formats
                .try_format(pos![C3])
                .unwrap_or_default()
                .fill_color,
            Some("red".to_string()),
            "C3 should have red fill color after filling from B2"
        );
    }

    #[test]
    fn test_format_operations_merged_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Merge cells A1:C3
        gc.merge_cells(A1Selection::test_a1("A1:C3"), None, false);

        // Test bold formatting
        gc.set_bold(&A1Selection::test_a1("B2"), Some(true), None, false)
            .unwrap();

        {
            let sheet = gc.sheet(sheet_id);
            // All cells within the merged cell should have bold formatting
            assert_eq!(
                sheet.formats.bold.get(pos![A1]),
                Some(true),
                "A1 should be bold"
            );
            assert_eq!(
                sheet.formats.bold.get(pos![B2]),
                Some(true),
                "B2 should be bold"
            );
            assert_eq!(
                sheet.formats.bold.get(pos![C3]),
                Some(true),
                "C3 should be bold"
            );
        }

        // Test text color formatting
        gc.set_text_color(
            &A1Selection::test_a1("A1"),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        {
            let sheet = gc.sheet(sheet_id);
            // All cells within the merged cell should have blue text color
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![A1])
                    .unwrap_or_default()
                    .text_color,
                Some("blue".to_string()),
                "A1 should have blue text color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![B2])
                    .unwrap_or_default()
                    .text_color,
                Some("blue".to_string()),
                "B2 should have blue text color"
            );
            assert_eq!(
                sheet
                    .formats
                    .try_format(pos![C3])
                    .unwrap_or_default()
                    .text_color,
                Some("blue".to_string()),
                "C3 should have blue text color"
            );
        }

        // Test italic formatting
        gc.set_italic(&A1Selection::test_a1("C1"), Some(true), None, false)
            .unwrap();

        {
            let sheet = gc.sheet(sheet_id);
            // All cells within the merged cell should have italic formatting
            assert_eq!(
                sheet.formats.italic.get(pos![A1]),
                Some(true),
                "A1 should be italic"
            );
            assert_eq!(
                sheet.formats.italic.get(pos![B2]),
                Some(true),
                "B2 should be italic"
            );
            assert_eq!(
                sheet.formats.italic.get(pos![C3]),
                Some(true),
                "C3 should be italic"
            );
        }
    }

    #[test]
    fn test_change_decimal_places_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // normal case
        gc.change_decimal_places(&A1Selection::test_a1("A1:B2"), 2, None, false)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .numeric_decimals,
            Some(2)
        );
    }

    #[test]
    fn test_set_underline_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_underline(&A1Selection::test_a1("A1:B2"), Some(true), None, false)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.underline.get(pos![A2]), Some(true));
    }

    #[test]
    fn test_set_strike_through_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_strike_through(&A1Selection::test_a1("A1:B2"), Some(true), None, false)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.strike_through.get(pos![A2]), Some(true));
    }

    #[test]
    fn test_clear_format() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_text_color(
            &A1Selection::test_a1("A1:B2"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A1])
                .unwrap_or_default()
                .text_color,
            Some("red".to_string())
        );

        let selection = A1Selection::from_xy(1, 1, sheet_id);
        gc.clear_format_borders(&selection, None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A1])
                .unwrap_or_default()
                .text_color,
            None
        );
    }

    #[test]
    fn test_clear_format_column() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_text_color(
            &A1Selection::test_a1("A"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.text_color.get(pos![A1]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![A100]),
            Some("red".to_string())
        );

        let selection = A1Selection::test_a1("A");
        gc.clear_format_borders(&selection, None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.text_color.get(pos![A1]), None);
        assert_eq!(sheet.formats.text_color.get(pos![A100]), None);
    }

    #[test]
    fn test_set_format_column_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_fill_color(
            &A1Selection::test_a1("1,3,A"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![D1]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![D3]),
            Some("red".to_string())
        );
    }

    #[test]
    fn test_clear_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_text_color(
            &A1Selection::test_a1("A1:B2"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.text_color.get(pos![A1]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![A2]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![B1]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![B2]),
            Some("red".to_string())
        );

        gc.clear_format_borders(&A1Selection::test_a1("A1:B2"), None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.text_color.get(pos![A1]), None);
        assert_eq!(sheet.formats.text_color.get(pos![A2]), None);
        assert_eq!(sheet.formats.text_color.get(pos![B1]), None);
        assert_eq!(sheet.formats.text_color.get(pos![B2]), None);
    }

    #[test]
    fn test_set_date_time_format() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_date_time_format(
            &A1Selection::test_a1("A1:B2"),
            Some("yyyy-mm-dd".to_string()),
            None,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(pos![A2])
                .unwrap_or_default()
                .date_time,
            Some("yyyy-mm-dd".to_string())
        );
    }

    #[test]
    fn test_apply_table_formats() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.test_set_data_table(
            pos!(E5).to_sheet_pos(sheet_id),
            3,
            3,
            false,
            Some(true),
            Some(true),
        );

        let format_update = FormatUpdate {
            bold: Some(Some(true)),
            ..Default::default()
        };
        let ops = gc.format_ops(
            &A1Selection::test_a1_context("Table1", gc.a1_context()),
            format_update.clone(),
            false,
            false,
        );
        assert_eq!(ops.len(), 1);

        let formats =
            SheetFormatUpdates::from_selection(&A1Selection::test_a1("A1:"), format_update);

        assert_eq!(
            ops[0],
            Operation::DataTableFormats {
                sheet_pos: SheetPos {
                    x: 5,
                    y: 5,
                    sheet_id
                },
                formats,
            }
        );

        gc.start_user_ai_transaction(ops, None, TransactionName::SetFormats, false);

        let sheet = gc.sheet(sheet_id);
        let format = sheet.cell_format(pos![F7]);
        assert_eq!(format.bold, Some(true));
    }

    #[test]
    fn test_single_cell_table_format_preserves_existing_formats() {
        // Test that setting bold on a single-cell table doesn't clear existing fill color
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a single-cell table (1x1) at E5
        gc.test_set_data_table(
            pos!(E5).to_sheet_pos(sheet_id),
            1,
            1,
            false,
            Some(false),
            Some(false),
        );

        // First, set fill color on the table
        gc.set_fill_color(
            &A1Selection::test_a1_context("Table1", gc.a1_context()),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        // Verify fill color was applied
        let sheet = gc.sheet(sheet_id);
        let format = sheet.cell_format(pos![E5]);
        assert_eq!(format.fill_color, Some("red".to_string()));

        // Now set bold on the same table
        gc.set_bold(
            &A1Selection::test_a1_context("Table1", gc.a1_context()),
            Some(true),
            None,
            false,
        )
        .unwrap();

        // Verify that BOTH fill color AND bold are present
        let sheet = gc.sheet(sheet_id);
        let format = sheet.cell_format(pos![E5]);
        assert_eq!(
            format.fill_color,
            Some("red".to_string()),
            "Fill color should be preserved after setting bold"
        );
        assert_eq!(format.bold, Some(true), "Bold should be set");
    }

    #[test]
    fn test_single_cell_table_format_preserves_existing_formats_sheet_path() {
        // Test that setting bold on a single-cell table via sheet reference (CellRefRange::Sheet)
        // doesn't clear existing fill color. This complements the test above which uses
        // CellRefRange::Table path.
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a single-cell table (1x1) at E5
        gc.test_set_data_table(
            pos!(E5).to_sheet_pos(sheet_id),
            1,
            1,
            false,
            Some(false),
            Some(false),
        );

        // First, set fill color using sheet reference "E5" (CellRefRange::Sheet path)
        gc.set_fill_color(
            &A1Selection::test_a1("E5"),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        // Verify fill color was applied
        let sheet = gc.sheet(sheet_id);
        let format = sheet.cell_format(pos![E5]);
        assert_eq!(format.fill_color, Some("blue".to_string()));

        // Now set bold using sheet reference "E5" (CellRefRange::Sheet path)
        gc.set_bold(&A1Selection::test_a1("E5"), Some(true), None, false)
            .unwrap();

        // Verify that BOTH fill color AND bold are present
        let sheet = gc.sheet(sheet_id);
        let format = sheet.cell_format(pos![E5]);
        assert_eq!(
            format.fill_color,
            Some("blue".to_string()),
            "Fill color should be preserved after setting bold via sheet reference"
        );
        assert_eq!(
            format.bold,
            Some(true),
            "Bold should be set via sheet reference"
        );
    }

    #[test]
    fn test_set_formats() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let selection = A1Selection::test_a1("A1:B2");

        // Create a format update with multiple changes
        let format_update = FormatUpdate {
            bold: Some(Some(true)),
            italic: Some(Some(true)),
            text_color: Some(Some("red".to_string())),
            fill_color: Some(Some("blue".to_string())),
            align: Some(Some(crate::grid::CellAlign::Center)),
            ..Default::default()
        };

        // Apply the formats
        gc.set_formats(&selection, format_update, None, false);

        // Verify the changes were applied
        let sheet = gc.sheet(sheet_id);
        let format = sheet.cell_format(pos![A1]);
        assert_eq!(format.bold, Some(true));
        assert_eq!(format.italic, Some(true));
        assert_eq!(format.text_color, Some("red".to_string()));
        assert_eq!(format.fill_color, Some("blue".to_string()));
        assert_eq!(format.align, Some(crate::grid::CellAlign::Center));

        // Verify the changes were applied to all cells in the selection
        let format = sheet.cell_format(pos![B2]);
        assert_eq!(format.bold, Some(true));
        assert_eq!(format.italic, Some(true));
        assert_eq!(format.text_color, Some("red".to_string()));
        assert_eq!(format.fill_color, Some("blue".to_string()));
        assert_eq!(format.align, Some(crate::grid::CellAlign::Center));
    }

    #[test]
    fn test_toggle_set_currency() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = A1Selection::from_xy(1, 1, sheet_id);

        // First call: set currency format
        gc.set_currency(&selection, "€".to_string(), None, false)
            .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(Pos { x: 1, y: 1 })
                .unwrap_or_default()
                .numeric_format,
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("€".to_string())
            })
        );

        // Second call: should toggle back to Number format
        gc.set_currency(&selection, "€".to_string(), None, false)
            .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(Pos { x: 1, y: 1 })
                .unwrap_or_default()
                .numeric_format,
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Number,
                symbol: None
            })
        );

        // Third call: should toggle back to Currency format
        gc.set_currency(&selection, "€".to_string(), None, false)
            .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(Pos { x: 1, y: 1 })
                .unwrap_or_default()
                .numeric_format,
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("€".to_string())
            })
        );
    }

    #[test]
    fn test_toggle_set_numeric_format() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = A1Selection::from_xy(1, 1, sheet_id);

        // First call: set percentage format
        gc.set_numeric_format(
            &selection,
            crate::grid::NumericFormatKind::Percentage,
            None,
            None,
            false,
        )
        .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(Pos { x: 1, y: 1 })
                .unwrap_or_default()
                .numeric_format,
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Percentage,
                symbol: None
            })
        );

        // Second call: should toggle back to Number format
        gc.set_numeric_format(
            &selection,
            crate::grid::NumericFormatKind::Percentage,
            None,
            None,
            false,
        )
        .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(Pos { x: 1, y: 1 })
                .unwrap_or_default()
                .numeric_format,
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Number,
                symbol: None
            })
        );

        // Third call: should toggle back to Percentage format
        gc.set_numeric_format(
            &selection,
            crate::grid::NumericFormatKind::Percentage,
            None,
            None,
            false,
        )
        .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .formats
                .try_format(Pos { x: 1, y: 1 })
                .unwrap_or_default()
                .numeric_format,
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Percentage,
                symbol: None
            })
        );
    }

    #[test]
    fn test_set_formats_a1() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create multiple format entries for different selections
        let format_entries = vec![
            (
                A1Selection::test_a1("A1:B2"),
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..Default::default()
                },
            ),
            (
                A1Selection::test_a1("C1:D2"),
                FormatUpdate {
                    italic: Some(Some(true)),
                    fill_color: Some(Some("red".to_string())),
                    ..Default::default()
                },
            ),
            (
                A1Selection::test_a1("E1"),
                FormatUpdate {
                    underline: Some(Some(true)),
                    text_color: Some(Some("blue".to_string())),
                    ..Default::default()
                },
            ),
        ];

        // Apply all formats in a single transaction
        gc.set_formats_a1(format_entries, None, false);

        // Verify the changes were applied to the first selection
        let sheet = gc.sheet(sheet_id);
        let format = sheet.cell_format(pos![A1]);
        assert_eq!(format.bold, Some(true));
        assert_eq!(format.italic, None);

        let format = sheet.cell_format(pos![B2]);
        assert_eq!(format.bold, Some(true));

        // Verify the changes were applied to the second selection
        let format = sheet.cell_format(pos![C1]);
        assert_eq!(format.italic, Some(true));
        assert_eq!(format.fill_color, Some("red".to_string()));
        assert_eq!(format.bold, None);

        let format = sheet.cell_format(pos![D2]);
        assert_eq!(format.italic, Some(true));
        assert_eq!(format.fill_color, Some("red".to_string()));

        // Verify the changes were applied to the third selection
        let format = sheet.cell_format(pos![E1]);
        assert_eq!(format.underline, Some(true));
        assert_eq!(format.text_color, Some("blue".to_string()));
        assert_eq!(format.bold, None);
        assert_eq!(format.italic, None);
    }

    #[test]
    fn test_set_formats_a1_single_undo() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create multiple format entries
        let format_entries = vec![
            (
                A1Selection::test_a1("A1"),
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..Default::default()
                },
            ),
            (
                A1Selection::test_a1("B1"),
                FormatUpdate {
                    italic: Some(Some(true)),
                    ..Default::default()
                },
            ),
        ];

        // Apply all formats in a single transaction
        gc.set_formats_a1(format_entries, None, false);

        // Verify both formats were applied
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.cell_format(pos![A1]).bold, Some(true));
        assert_eq!(sheet.cell_format(pos![B1]).italic, Some(true));

        // Undo should revert both changes in one operation
        gc.undo(1, None, false);

        // Verify both formats were reverted
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.cell_format(pos![A1]).bold, None);
        assert_eq!(sheet.cell_format(pos![B1]).italic, None);
    }

    #[test]
    fn test_format_column_with_merged_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a merged cell spanning columns B-D, rows 2-4
        gc.merge_cells(A1Selection::test_a1("B2:D4"), None, false);

        // Format column B (which intersects the merged cell)
        gc.set_fill_color(
            &A1Selection::test_a1("B"),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        // All cells within the merged cell should have the fill color
        let sheet = gc.sheet(sheet_id);

        // Check cells in the merged region
        assert_eq!(
            sheet.formats.fill_color.get(pos![B2]),
            Some("blue".to_string()),
            "B2 should have fill color"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![C3]),
            Some("blue".to_string()),
            "C3 (in merged cell) should have fill color"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![D4]),
            Some("blue".to_string()),
            "D4 (in merged cell) should have fill color"
        );

        // Cells in column B but outside merged cell should also have fill color
        assert_eq!(
            sheet.formats.fill_color.get(pos![B1]),
            Some("blue".to_string()),
            "B1 should have fill color (column formatting)"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![B10]),
            Some("blue".to_string()),
            "B10 should have fill color (column formatting)"
        );
    }

    #[test]
    fn test_format_row_with_merged_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a merged cell spanning columns B-D, rows 2-4
        gc.merge_cells(A1Selection::test_a1("B2:D4"), None, false);

        // Format row 2 (which intersects the merged cell)
        gc.set_bold(&A1Selection::test_a1("2"), Some(true), None, false)
            .unwrap();

        // All cells within the merged cell should have the bold formatting
        let sheet = gc.sheet(sheet_id);

        // Check cells in the merged region
        assert_eq!(
            sheet.formats.bold.get(pos![B2]),
            Some(true),
            "B2 should be bold"
        );
        assert_eq!(
            sheet.formats.bold.get(pos![C3]),
            Some(true),
            "C3 (in merged cell) should be bold"
        );
        assert_eq!(
            sheet.formats.bold.get(pos![D4]),
            Some(true),
            "D4 (in merged cell) should be bold"
        );

        // Cells in row 2 but outside merged cell should also be bold
        assert_eq!(
            sheet.formats.bold.get(pos![A2]),
            Some(true),
            "A2 should be bold (row formatting)"
        );
        assert_eq!(
            sheet.formats.bold.get(pos![Z2]),
            Some(true),
            "Z2 should be bold (row formatting)"
        );
    }

    #[test]
    fn test_format_column_with_multiple_merged_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create two merged cells in column B
        gc.merge_cells(A1Selection::test_a1("B2:C3"), None, false);
        gc.merge_cells(A1Selection::test_a1("B5:D6"), None, false);

        // Format column B (which intersects both merged cells)
        gc.set_italic(&A1Selection::test_a1("B"), Some(true), None, false)
            .unwrap();

        let sheet = gc.sheet(sheet_id);

        // Check first merged cell (B2:C3)
        assert_eq!(
            sheet.formats.italic.get(pos![B2]),
            Some(true),
            "B2 should be italic"
        );
        assert_eq!(
            sheet.formats.italic.get(pos![C3]),
            Some(true),
            "C3 (in first merged cell) should be italic"
        );

        // Check second merged cell (B5:D6)
        assert_eq!(
            sheet.formats.italic.get(pos![B5]),
            Some(true),
            "B5 should be italic"
        );
        assert_eq!(
            sheet.formats.italic.get(pos![D6]),
            Some(true),
            "D6 (in second merged cell) should be italic"
        );
    }
}
