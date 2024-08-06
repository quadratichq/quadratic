//! This module contains the implementation for changing formats within the
//! Grid. These functions use the newer Operation::SetCellFormatsSelection,
//! which provide formats for a user-defined selection.

use wasm_bindgen::JsValue;

use crate::{
    controller::{
        active_transactions::transaction_name::TransactionName, operations::operation::Operation,
        GridController,
    },
    grid::{
        formats::{format_update::FormatUpdate, Formats},
        CellAlign, CellVerticalAlign, CellWrap, NumericFormat, NumericFormatKind,
    },
    selection::Selection,
};

impl GridController {
    pub(crate) fn clear_format(
        &mut self,
        selection: Selection,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let ops = self.clear_format_selection_operations(&selection);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_align_selection(
        &mut self,
        selection: Selection,
        align: CellAlign,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                align: Some(Some(align)),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_vertical_align_selection(
        &mut self,
        selection: Selection,
        vertical_align: CellVerticalAlign,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                vertical_align: Some(Some(vertical_align)),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_bold_selection(
        &mut self,
        selection: Selection,
        bold: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(bold)),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_italic_selection(
        &mut self,
        selection: Selection,
        italic: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                italic: Some(Some(italic)),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_cell_wrap_selection(
        &mut self,
        selection: Selection,
        wrap: CellWrap,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                wrap: Some(Some(wrap)),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    /// Changes the Selection to use a currency format and updates the decimals
    /// to 2.
    pub(crate) fn set_currency_selection(
        &mut self,
        selection: Selection,
        symbol: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                numeric_format: Some(Some(NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some(symbol),
                })),
                numeric_decimals: Some(Some(2)),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_numeric_format_selection(
        &mut self,
        selection: Selection,
        kind: NumericFormatKind,
        symbol: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                numeric_format: Some(Some(NumericFormat { kind, symbol })),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_commas_selection(
        &mut self,
        selection: Selection,
        commas: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                numeric_commas: Some(Some(commas)),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_text_color_selection(
        &mut self,
        selection: Selection,
        color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                text_color: Some(color),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn set_fill_color_selection(
        &mut self,
        selection: Selection,
        color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                fill_color: Some(color),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn remove_number_formatting_selection(
        &mut self,
        selection: Selection,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let formats = Formats::repeat(
            FormatUpdate {
                numeric_format: Some(None),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }

    pub(crate) fn change_decimal_places_selection(
        &mut self,
        selection: Selection,
        delta: u32,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return Err("Sheet not found".into());
        };
        let source = selection.source();
        let kind = sheet.cell_numeric_format_kind(source);
        let source_decimals = sheet.calculate_decimal_places(source, kind).unwrap_or(0);
        let new_precision = i16::max(0, source_decimals + (delta as i16));
        let formats = Formats::repeat(
            FormatUpdate {
                numeric_decimals: Some(Some(new_precision)),
                ..Default::default()
            },
            selection.count(),
        );
        let ops = vec![Operation::SetCellFormatsSelection { selection, formats }];
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, grid::CellWrap, selection::Selection, Rect};
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn set_align_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_align_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            crate::grid::CellAlign::Center,
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().align.get(0),
            Some(crate::grid::CellAlign::Center)
        );
    }

    #[test]
    #[parallel]
    fn set_vertical_align_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_vertical_align_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            crate::grid::CellVerticalAlign::Middle,
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().vertical_align.get(0),
            Some(crate::grid::CellVerticalAlign::Middle)
        );
    }

    #[test]
    #[parallel]
    fn set_bold_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_bold_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            true,
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.columns.get(&0).unwrap().bold.get(0), Some(true));
    }

    #[test]
    #[parallel]
    fn set_cell_wrap_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_wrap_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            CellWrap::Clip,
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().wrap.get(0),
            Some(CellWrap::Clip)
        );
    }

    #[test]
    #[parallel]
    fn set_numeric_format_currency() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_currency_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            "€".to_string(),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().numeric_format.get(0),
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("€".to_string())
            })
        );
    }

    #[test]
    #[parallel]
    fn set_numeric_format_exponential() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_numeric_format_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            crate::grid::NumericFormatKind::Exponential,
            None,
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().numeric_format.get(0),
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Exponential,
                symbol: None
            })
        );
    }

    #[test]
    #[parallel]
    fn set_numeric_format_percentage() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_numeric_format_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            crate::grid::NumericFormatKind::Percentage,
            None,
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().numeric_format.get(0),
            Some(crate::grid::NumericFormat {
                kind: crate::grid::NumericFormatKind::Percentage,
                symbol: None
            })
        );
    }

    #[test]
    #[parallel]
    fn toggle_commas_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_commas_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            true,
            None,
        )
        .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().numeric_commas.get(0),
            Some(true)
        );

        gc.set_commas_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            false,
            None,
        )
        .unwrap();
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().numeric_commas.get(0),
            Some(false)
        );
    }

    #[test]
    #[parallel]
    fn set_italic_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_italic_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            true,
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.columns.get(&0).unwrap().italic.get(0), Some(true));
    }

    #[test]
    #[parallel]
    fn set_text_color_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_text_color_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            Some("red".to_string()),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().text_color.get(0),
            Some("red".to_string())
        );
    }

    #[test]
    #[parallel]
    fn set_fill_color_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_fill_color_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            Some("blue".to_string()),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().fill_color.get(0),
            Some("blue".to_string())
        );
    }

    #[test]
    #[parallel]
    fn change_decimal_places_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // normal case
        gc.change_decimal_places_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            2,
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().numeric_decimals.get(0),
            Some(2)
        );
    }

    #[test]
    #[parallel]
    fn clear_format() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_text_color_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            Some("red".to_string()),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.columns.get(&0).unwrap().text_color.get(0),
            Some("red".to_string())
        );

        gc.clear_format(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(0, 0, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            },
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.columns.get(&0).unwrap().text_color.get(0), None);
    }

    #[test]
    #[parallel]
    fn clear_format_column() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_text_color_selection(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: None,
                rows: None,
                columns: Some(vec![0]),
                all: false,
            },
            Some("red".to_string()),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.format_column(0).text_color, Some("red".to_string()));

        gc.clear_format(
            Selection {
                sheet_id,
                x: 0,
                y: 0,
                rects: None,
                rows: None,
                columns: Some(vec![0]),
                all: false,
            },
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.format_column(0).text_color, None);
        assert!(sheet.formats_columns.is_empty());
    }

    #[test]
    #[parallel]
    fn set_format_column_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_fill_color_selection(
            Selection {
                sheet_id,
                rows: Some(vec![0, 2]),
                columns: Some(vec![1]),
                ..Default::default()
            },
            Some("red".to_string()),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.format_column(1).fill_color, Some("red".to_string()));
        assert_eq!(sheet.format_row(0).fill_color, Some("red".to_string()));
        assert_eq!(sheet.format_row(2).fill_color, Some("red".to_string()));
    }
}
