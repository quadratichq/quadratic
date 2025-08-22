//! This module contains the implementation for changing formats within the
//! Grid. These functions use the newer Operation::SetCellFormatsSelection,
//! which provide formats for a user-defined selection.

use wasm_bindgen::JsValue;

use crate::a1::{A1Selection, CellRefRange};
use crate::controller::GridController;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::operations::operation::Operation;
use crate::grid::formats::{FormatUpdate, SheetFormatUpdates};
use crate::grid::{CellAlign, CellVerticalAlign, CellWrap, NumericFormat, NumericFormatKind};

impl GridController {
    pub(crate) fn clear_format_borders(&mut self, selection: &A1Selection, cursor: Option<String>) {
        let ops = self.clear_format_borders_operations(selection, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
    }

    /// Separately apply sheet and table formats.
    pub(crate) fn format_ops(
        &self,
        selection: &A1Selection,
        format_update: FormatUpdate,
        ignore_tables_having_anchoring_cell_in_selection: bool,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return ops;
        };

        let mut sheet_format_update =
            SheetFormatUpdates::from_selection(selection, format_update.clone());

        for range in selection.ranges.iter() {
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

                        let table_format_updates = data_table
                            .transfer_formats_from_sheet_format_updates(
                                data_table_pos,
                                intersection_rect,
                                &mut sheet_format_update,
                            );

                        sheet_format_update
                            .set_format_rect(intersection_rect, FormatUpdate::cleared());

                        if let Some(table_format_updates) = table_format_updates
                            && !table_format_updates.is_default() {
                                ops.push(Operation::DataTableFormats {
                                    sheet_pos: data_table_pos.to_sheet_pos(selection.sheet_id),
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
                            &A1Selection::from_rect(format_rect.to_sheet_rect(selection.sheet_id)),
                            format_update.clone(),
                        );

                        if !table_format_updates.is_default() {
                            ops.push(Operation::DataTableFormats {
                                sheet_pos: data_table_pos.to_sheet_pos(selection.sheet_id),
                                formats: table_format_updates,
                            });
                        }
                    }
                }
            }
        }

        if !sheet_format_update.is_default() {
            ops.push(Operation::SetCellFormatsA1 {
                sheet_id: selection.sheet_id,
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
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            align: Some(Some(align)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_vertical_align(
        &mut self,
        selection: &A1Selection,
        vertical_align: CellVerticalAlign,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            vertical_align: Some(Some(vertical_align)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_bold(
        &mut self,
        selection: &A1Selection,
        bold: Option<bool>,
        cursor: Option<String>,
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
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_italic(
        &mut self,
        selection: &A1Selection,
        italic: Option<bool>,
        cursor: Option<String>,
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
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_cell_wrap(
        &mut self,
        selection: &A1Selection,
        wrap: CellWrap,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            wrap: Some(Some(wrap)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    /// Changes the Selection to use a currency format and updates the decimals
    /// to 2.
    pub(crate) fn set_currency(
        &mut self,
        selection: &A1Selection,
        symbol: String,
        cursor: Option<String>,
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
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_numeric_format(
        &mut self,
        selection: &A1Selection,
        kind: NumericFormatKind,
        symbol: Option<String>,
        cursor: Option<String>,
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
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_commas(
        &mut self,
        selection: &A1Selection,
        commas: Option<bool>,
        cursor: Option<String>,
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
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_text_color(
        &mut self,
        selection: &A1Selection,
        color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            text_color: Some(color),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_fill_color(
        &mut self,
        selection: &A1Selection,
        color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            fill_color: Some(color),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn remove_number_formatting(
        &mut self,
        selection: &A1Selection,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            numeric_format: Some(None),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn change_decimal_places(
        &mut self,
        selection: &A1Selection,
        delta: i32,
        cursor: Option<String>,
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
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_date_time_format(
        &mut self,
        selection: &A1Selection,
        date_time: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let format_update = FormatUpdate {
            date_time: Some(date_time),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_underline(
        &mut self,
        selection: &A1Selection,
        underline: Option<bool>,
        cursor: Option<String>,
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
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_strike_through(
        &mut self,
        selection: &A1Selection,
        strike_through: Option<bool>,
        cursor: Option<String>,
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
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_formats(&mut self, selection: &A1Selection, format_update: FormatUpdate) {
        let ops = self.format_ops(selection, format_update, false);
        self.start_user_transaction(ops, None, TransactionName::SetFormats);
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
        gc.set_bold(&A1Selection::test_a1("A1:B2"), Some(true), None)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.format(pos![A2]).bold, Some(true));
    }

    #[test]
    fn test_set_cell_wrap_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_wrap(&A1Selection::test_a1("A1:B2"), CellWrap::Clip, None)
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
        gc.set_currency(&selection, "€".to_string(), None).unwrap();

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
        gc.set_commas(&A1Selection::test_a1("A1:B2"), Some(true), None)
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

        gc.set_commas(&A1Selection::test_a1("A1:B2"), Some(false), None)
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
        gc.set_italic(&A1Selection::test_a1("A1:B2"), Some(true), None)
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
    fn test_change_decimal_places_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // normal case
        gc.change_decimal_places(&A1Selection::test_a1("A1:B2"), 2, None)
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
        gc.set_underline(&A1Selection::test_a1("A1:B2"), Some(true), None)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.underline.get(pos![A2]), Some(true));
    }

    #[test]
    fn test_set_strike_through_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_strike_through(&A1Selection::test_a1("A1:B2"), Some(true), None)
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
        gc.clear_format_borders(&selection, None);

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
        gc.set_text_color(&A1Selection::test_a1("A"), Some("red".to_string()), None)
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
        gc.clear_format_borders(&selection, None);

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

        gc.clear_format_borders(&A1Selection::test_a1("A1:B2"), None);

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

        gc.start_user_transaction(ops, None, TransactionName::SetFormats);

        let sheet = gc.sheet(sheet_id);
        let format = sheet.cell_format(pos![F7]);
        assert_eq!(format.bold, Some(true));
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
        gc.set_formats(&selection, format_update);

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
        gc.set_currency(&selection, "€".to_string(), None).unwrap();
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
        gc.set_currency(&selection, "€".to_string(), None).unwrap();
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
        gc.set_currency(&selection, "€".to_string(), None).unwrap();
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
}
