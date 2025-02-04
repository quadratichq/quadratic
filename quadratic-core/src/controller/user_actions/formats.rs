//! This module contains the implementation for changing formats within the
//! Grid. These functions use the newer Operation::SetCellFormatsSelection,
//! which provide formats for a user-defined selection.

use wasm_bindgen::JsValue;

use crate::a1::{A1Selection, CellRefRange, RefRangeBounds, TableMapEntry};
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;
use crate::grid::formats::{FormatUpdate, SheetFormatUpdates};
use crate::grid::{CellAlign, CellVerticalAlign, CellWrap, NumericFormat, NumericFormatKind};

impl GridController {
    pub(crate) fn clear_format_borders(&mut self, selection: &A1Selection, cursor: Option<String>) {
        let ops = self.clear_format_borders_operations(selection);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
    }

    /// Separately apply sheet and table formats.
    fn format_ops(
        &mut self,
        selection: &A1Selection,
        format_update: FormatUpdate,
    ) -> Vec<Operation> {
        let mut ops = vec![];

        let context = self.grid.a1_context();

        let add_table_ops = |range: RefRangeBounds,
                             table: &TableMapEntry,
                             ops: &mut Vec<Operation>| {
            // pos relative to table pos (top left pos), 1-based for formatting
            let mut range = range.translate(
                -table.bounds.min.x + 1,
                -table.bounds.min.y + 1 - table.y_adjustment(true),
            );

            // map visible index to actual column index
            range.start.col.coord = table
                .get_column_index_from_visible_index(range.start.col.coord as usize - 1)
                .unwrap_or(range.start.col.coord as usize - 1)
                as i64
                + 1;

            // map visible index to actual column index
            range.end.col.coord = table
                .get_column_index_from_visible_index(range.end.col.coord as usize - 1)
                .unwrap_or(range.end.col.coord as usize - 1)
                as i64
                + 1;

            let mut ranges = vec![CellRefRange::Sheet { range }];

            if let Some(rect) = range.to_rect() {
                let Some(sheet) = self.try_sheet(table.sheet_id) else {
                    return;
                };

                let data_table_pos = table.bounds.min;
                let Some(data_table) = sheet.data_table(data_table_pos) else {
                    return;
                };

                if data_table.display_buffer.is_some() {
                    ranges.clear();
                    // y is 1-based
                    for y in rect.y_range() {
                        // get actual row index and convert to 1-based
                        let actual_row = data_table.transmute_index(y as u64 - 1) + 1;
                        for x in rect.x_range() {
                            ranges.push(CellRefRange::new_relative_xy(x, actual_row as i64));
                        }
                    }
                }
            }

            if let Some(selection) = A1Selection::from_ranges(ranges, table.sheet_id, &context) {
                let formats = SheetFormatUpdates::from_selection(&selection, format_update.clone());

                // add table operation
                ops.push(Operation::DataTableFormats {
                    sheet_pos: table.bounds.min.to_sheet_pos(table.sheet_id),
                    formats,
                });

                // clear sheet formatting if needed
                if let Some(cleared) = format_update.only_cleared() {
                    ops.push(Operation::SetCellFormatsA1 {
                        sheet_id: table.sheet_id,
                        formats: SheetFormatUpdates::from_selection(&selection, cleared),
                    });
                }
            }
        };

        let (sheet_ranges, table_ranges) = selection.separate_table_ranges();

        // find intersection of sheet selection with tables, apply updates to both sheet and respective table
        if let Some(mut sheet_selection) =
            A1Selection::from_sheet_ranges(sheet_ranges.clone(), selection.sheet_id, &context)
        {
            for sheet_range in sheet_ranges {
                let rect = sheet_range.to_rect_unbounded();
                for table in context.tables() {
                    if let Some(intersection) = table.bounds.intersection(&rect) {
                        // remove table intersection from the sheet selection
                        sheet_selection.exclude_cells(
                            intersection.min,
                            Some(intersection.max),
                            &context,
                        );
                        // residual single cursor selection, clear if it belongs to the table
                        if let Some(pos) = sheet_selection.try_to_pos(&context) {
                            if table.bounds.contains(pos) {
                                sheet_selection.ranges.clear();
                            }
                        }
                        let range = RefRangeBounds::new_relative_rect(intersection);
                        add_table_ops(range, table, &mut ops);
                    }
                }
            }

            if !sheet_selection.ranges.is_empty() {
                ops.push(Operation::SetCellFormatsA1 {
                    sheet_id: selection.sheet_id,
                    // from_selection ignores TableRefs
                    formats: SheetFormatUpdates::from_selection(
                        &sheet_selection,
                        format_update.clone(),
                    ),
                });
            }
        }

        // set table formats
        for table_ref in table_ranges {
            if let Some(table) = context.try_table(&table_ref.table_name) {
                table_ref
                    .convert_to_ref_range_bounds(true, &context, false, true)
                    .map(|range| add_table_ops(range, table, &mut ops));
            }
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
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let format_update = FormatUpdate {
            numeric_format: Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some(symbol),
            })),
            numeric_decimals: Some(Some(2)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update);
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
        let format_update = FormatUpdate {
            numeric_format: Some(Some(NumericFormat { kind, symbol })),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let kind = sheet.cell_numeric_format_kind(selection.cursor);
        let source_decimals = sheet
            .calculate_decimal_places(selection.cursor, kind)
            .unwrap_or(0);
        let new_precision = i16::max(0, source_decimals + (delta as i16));
        let format_update = FormatUpdate {
            numeric_decimals: Some(Some(new_precision)),
            ..Default::default()
        };
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
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
        let ops = self.format_ops(selection, format_update);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod test {
    use crate::controller::operations::operation::Operation;
    use crate::controller::GridController;
    use crate::grid::formats::{FormatUpdate, SheetFormatUpdates};
    use crate::grid::CellWrap;
    use crate::SheetPos;
    use crate::{a1::A1Selection, Pos};

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
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_data_table(pos!(E5), 3, 3, false, true);
        let format_update = FormatUpdate {
            bold: Some(Some(true)),
            ..Default::default()
        };
        let ops = gc.format_ops(
            &A1Selection::test_a1_context("Table1", &gc.grid.a1_context()),
            format_update.clone(),
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
    }
}
