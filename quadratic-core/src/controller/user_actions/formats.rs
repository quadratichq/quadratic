//! This module contains the implementation for changing formats within the
//! Grid. These functions use the newer Operation::SetCellFormatsSelection,
//! which provide formats for a user-defined selection.

use wasm_bindgen::JsValue;

use crate::a1::{A1Selection, CellRefRange, RefRangeBounds};
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
        let (tables, non_tables) = selection.separate_table_ranges();
        let mut ops = vec![];

        // create ops for the sheet if needed (ignoring TableRefs)
        if !non_tables.is_empty() {
            ops.push(Operation::SetCellFormatsA1 {
                sheet_id: selection.sheet_id,
                // from_selection ignores TableRefs
                formats: SheetFormatUpdates::from_selection(selection, format_update.clone()),
            });
        }

        let context = self.grid.a1_context();

        // set table ranges
        for table_ref in tables {
            if let Some(table) = context.try_table(&table_ref.table_name) {
                let range = table_ref.convert_to_ref_range_bounds(true, &context);
                if let Some(range) = range {
                    // translate the range to 1-based compared to the table position
                    let range = range.translate(-table.bounds.min.x + 1, -table.bounds.min.y + 1);
                    let formats = SheetFormatUpdates::from_selection(
                        &A1Selection::from_range(
                            CellRefRange::Sheet { range },
                            table.sheet_id,
                            &context,
                        ),
                        format_update.clone(),
                    );
                    ops.push(Operation::DataTableFormats {
                        sheet_pos: table.bounds.min.to_sheet_pos(table.sheet_id),
                        formats,
                    });

                    // check if we need to clear the underlying sheet formatting
                    if let Some(cleared) = format_update.only_cleared() {
                        ops.push(Operation::SetCellFormatsA1 {
                            sheet_id: table.sheet_id,
                            formats: SheetFormatUpdates::from_selection(
                                &A1Selection::from_range(
                                    CellRefRange::Sheet { range },
                                    table.sheet_id,
                                    &context,
                                ),
                                cleared,
                            ),
                        });
                    }
                }
            }
        }

        // clear table formats for sheet ranges that overlap tables
        let clear_format_update = format_update.clear_update();
        for range in non_tables {
            let rect = range.to_rect_unbounded();
            for table in context.tables() {
                if let Some(intersection) = table.bounds.intersection(&rect) {
                    let range = RefRangeBounds::new_relative_rect(intersection);

                    // normalize the range to the table position
                    let range = range.translate(-table.bounds.min.x + 1, -table.bounds.min.y + 1);

                    ops.push(Operation::DataTableFormats {
                        sheet_pos: table.bounds.min.to_sheet_pos(table.sheet_id),
                        formats: SheetFormatUpdates::from_selection(
                            &A1Selection::from_range(
                                CellRefRange::Sheet { range },
                                table.sheet_id,
                                &context,
                            ),
                            clear_format_update.clone(),
                        ),
                    });
                }
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
        bold: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
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
        italic: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
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
        commas: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
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
        underline: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
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
        strike_through: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
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
        gc.set_bold(&A1Selection::test_a1("A1:B2"), true, None)
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
        gc.set_commas(&A1Selection::test_a1("A1:B2"), true, None)
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

        gc.set_commas(&A1Selection::test_a1("A1:B2"), false, None)
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
        gc.set_italic(&A1Selection::test_a1("A1:B2"), true, None)
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
        gc.set_underline(&A1Selection::test_a1("A1:B2"), true, None)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.formats.underline.get(pos![A2]), Some(true));
    }

    #[test]
    fn test_set_strike_through_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_strike_through(&A1Selection::test_a1("A1:B2"), true, None)
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
        sheet.test_set_code_run_array_2d(
            5,
            5,
            3,
            3,
            vec!["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        );
        let format_update = FormatUpdate {
            bold: Some(Some(true)),
            ..Default::default()
        };
        let ops = gc.format_ops(
            &A1Selection::test_a1_context("Table1", &gc.grid.a1_context()),
            format_update.clone(),
        );
        assert_eq!(ops.len(), 1);
        let formats = SheetFormatUpdates::from_selection(&A1Selection::test_a1("*"), format_update);
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
