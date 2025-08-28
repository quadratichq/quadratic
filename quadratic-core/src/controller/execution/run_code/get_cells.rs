use ts_rs::TS;
use uuid::Uuid;

use crate::{
    CellValue, a1::CellRefRange, controller::GridController, error_core::CoreError,
    grid::CodeCellLanguage,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsCellsA1Response {
    pub values: Option<JsCellsA1Values>,
    pub error: Option<JsCellsA1Error>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsCellsA1Values {
    pub cells: Vec<JsCellsA1Value>,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub one_dimensional: bool,
    pub two_dimensional: bool,
    pub has_headers: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsCellsA1Value {
    pub x: i32,
    pub y: i32,
    pub v: String,
    pub t: u8,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsCellsA1Error {
    pub core_error: String,
}

impl GridController {
    /// This is used to get cells during an async calculation.
    pub fn calculation_get_cells_a1(
        &mut self,
        transaction_id: String,
        a1: String,
    ) -> JsCellsA1Response {
        let map_error = |e: CoreError| JsCellsA1Response {
            values: None,
            error: Some(JsCellsA1Error {
                core_error: e.to_string(),
            }),
        };

        let Ok(transaction_id) = Uuid::parse_str(&transaction_id) else {
            return map_error(CoreError::TransactionNotFound(
                "Transaction Id is invalid".into(),
            ));
        };

        let Ok(mut transaction) = self.transactions.get_async_transaction(transaction_id) else {
            return map_error(CoreError::TransactionNotFound(
                "Transaction Id not found".into(),
            ));
        };

        if !transaction.is_user_ai_undo_redo() {
            return map_error(CoreError::TransactionNotFound(
                "getCells can only be called for user / undo-redo transaction".to_string(),
            ));
        }

        let Some(code_sheet_pos) = transaction.current_sheet_pos else {
            return map_error(CoreError::TransactionNotFound(
                "Transaction's position not found".into(),
            ));
        };
        let selection = match self.a1_selection_from_string(&a1, code_sheet_pos.sheet_id) {
            Ok(selection) => selection,
            Err(e) => {
                // unable to parse A1 string
                return map_error(CoreError::A1Error(e.to_string()));
            }
        };

        let context = self.a1_context();

        // ensure that the selection is not a direct self reference
        if selection.sheet_id == code_sheet_pos.sheet_id
            && selection.might_contain_pos(code_sheet_pos.into(), context)
        {
            return map_error(CoreError::A1Error("Self reference not allowed".to_string()));
        }

        let Some(selection_sheet) = self.try_sheet(selection.sheet_id) else {
            return map_error(CoreError::CodeCellSheetError("Sheet not found".to_string()));
        };
        let Some(code_sheet) = self.try_sheet(code_sheet_pos.sheet_id) else {
            return map_error(CoreError::CodeCellSheetError("Sheet not found".to_string()));
        };

        // get the original code cell
        let Some(CellValue::Code(code)) = code_sheet.cell_value(code_sheet_pos.into()) else {
            return map_error(CoreError::CodeCellSheetError(
                "Code cell not found".to_string(),
            ));
        };

        let force_columns = matches!(
            code.language,
            CodeCellLanguage::Python | CodeCellLanguage::Javascript
        );

        let rects = selection_sheet.selection_to_rects(
            &selection,
            force_columns,
            false,
            true,
            &self.a1_context,
        );
        if rects.len() > 1 {
            return map_error(CoreError::A1Error(
                "Multiple rects not supported".to_string(),
            ));
        }

        selection.ranges.iter().for_each(|range| {
            transaction
                .cells_accessed
                .add(selection_sheet.id, range.clone());
        });
        self.transactions.update_async_transaction(&transaction);

        let context = self.a1_context();
        let Some(selection_sheet) = self.try_sheet(selection.sheet_id) else {
            return map_error(CoreError::CodeCellSheetError("Sheet not found".to_string()));
        };

        let values = if let Some(rect) = rects.first() {
            // Tracks whether to force the get_cells call to return a 2D array.
            // The use case is where the rect is currently one-dimensional, but
            // the selection may change to two-dimensional based on data bounds.
            // For example, "2:" or "B5:".
            let two_dimensional = if let Some(range) = selection.ranges.first() {
                match range {
                    CellRefRange::Sheet { range } => {
                        (range.end.col.is_unbounded() && range.end.row.is_unbounded())
                            || !(range.start.row.coord == range.end.row.coord
                                || range.start.col.coord == range.end.col.coord)
                    }
                    CellRefRange::Table { range } => range.is_two_dimensional(),
                }
            } else {
                false
            };

            let cells = selection_sheet.get_cells_response(*rect);
            let is_python = matches!(code.language, CodeCellLanguage::Python);

            JsCellsA1Values {
                cells,
                x: rect.min.x as i32,
                y: rect.min.y as i32,
                w: rect.width() as i32,
                h: rect.height() as i32,
                one_dimensional: selection.is_col_range(),
                two_dimensional,
                has_headers: selection.has_table_headers(context, is_python),
            }
        } else {
            JsCellsA1Values {
                cells: vec![],
                x: 1,
                y: 1,
                w: 0,
                h: 0,
                one_dimensional: false,
                two_dimensional: false,
                has_headers: false,
            }
        };

        JsCellsA1Response {
            values: Some(values),
            error: None,
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        Pos, Rect, SheetPos, controller::transaction_types::JsCodeResult, grid::CodeCellLanguage,
    };

    #[test]
    fn test_calculation_get_cells_bad_transaction_id() {
        let mut gc = GridController::test();

        let result =
            gc.calculation_get_cells_a1("bad transaction id".to_string(), "A1".to_string());
        assert!(result.error.is_some());
    }

    #[test]
    fn test_calculation_get_cells_no_transaction() {
        let mut gc = GridController::test();

        let result = gc.calculation_get_cells_a1(Uuid::new_v4().to_string(), "A1".to_string());
        assert!(result.error.is_some());
    }

    #[test]
    fn test_calculation_get_cells_transaction_but_no_current_sheet_pos() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );

        let transactions = gc.transactions.async_transactions_mut();
        transactions[0].current_sheet_pos = None;
        let transaction_id = transactions[0].id.to_string();
        let result = gc.calculation_get_cells_a1(transaction_id, "A1".to_string());
        assert!(result.error.is_some());
    }

    #[test]
    fn test_calculation_get_cells_sheet_name_not_found() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result = gc.calculation_get_cells_a1(
            transaction_id.to_string(),
            "'bad sheet name'!A1".to_string(),
        );
        assert!(result.error.is_some());
        gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: false,
            std_err: Some("Invalid Sheet Name: bad sheet name".to_string()),
            ..Default::default()
        })
        .unwrap();
        let sheet = gc.sheet(sheet_id);
        let error = sheet
            .data_table_at(&Pos { x: 1, y: 1 })
            .unwrap()
            .code_run()
            .unwrap()
            .clone()
            .std_err
            .unwrap();
        assert!(error.contains("Invalid Sheet Name: bad sheet name"));
    }

    // This was previously disallowed. It is now allowed to unlock appending results.
    // Leaving in some commented out code in case we want to revert this behavior.
    #[test]
    fn test_calculation_get_cells_self_reference() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "10".to_string(),
            None,
            false,
        );
        // async python
        gc.set_code_cell(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            crate::grid::CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string());
        assert!(result.error.is_none());

        let sheet = gc.sheet(sheet_id);
        let code = sheet.get_render_cells(Rect::from_numbers(2, 1, 1, 1), gc.a1_context());
        assert_eq!(code.len(), 0);
        // assert_eq!(code[0].special, Some(JsRenderCellSpecial::RunError));
        // let sheet = gc.sheet(sheet_id);
        // let error = sheet
        //     .code_run(Pos { x: 0, y: 1 })
        //     .unwrap()
        //     .clone()
        //     .std_err
        //     .unwrap();
        // assert!(error.is_empty());
    }

    #[test]
    fn test_calculation_get_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "test".to_string(),
            None,
            false,
        );

        gc.set_code_cell(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string());
        assert_eq!(
            result,
            JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![JsCellsA1Value {
                        x: 1,
                        y: 1,
                        v: "test".into(),
                        t: 1,
                    }],
                    x: 1,
                    y: 1,
                    w: 1,
                    h: 1,
                    one_dimensional: false,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            }
        );
    }

    #[test]
    fn calculation_get_cells_with_no_y1() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "test1".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "test2".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 3,
                sheet_id,
            },
            "test3".to_string(),
            None,
            false,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 5,
                sheet_id,
            },
            "test4".to_string(),
            None,
            false,
        );

        // create a code cell so we can get a transaction_id
        gc.set_code_cell(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );

        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1:A".to_string());
        assert_eq!(
            result,
            JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![
                        JsCellsA1Value {
                            x: 1,
                            y: 1,
                            v: "test1".into(),
                            t: 1
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 2,
                            v: "test2".into(),
                            t: 1
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 3,
                            v: "test3".into(),
                            t: 1
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 4,
                            v: "".into(),
                            t: 0
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 5,
                            v: "test4".into(),
                            t: 1
                        }
                    ],
                    x: 1,
                    y: 1,
                    w: 1,
                    h: 5,
                    one_dimensional: true,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            }
        );
    }

    #[test]
    fn calculation_get_cells_a1() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "test".to_string(),
            None,
            false,
        );

        gc.set_code_cell(
            SheetPos::new(sheet_id, 2, 2),
            CodeCellLanguage::Javascript,
            "".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string());
        assert_eq!(
            result,
            JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![JsCellsA1Value {
                        x: 1,
                        y: 1,
                        v: "test".into(),
                        t: 1
                    }],
                    x: 1,
                    y: 1,
                    w: 1,
                    h: 1,
                    one_dimensional: false,
                    two_dimensional: false,
                    has_headers: false,
                }),
                error: None,
            }
        );
    }

    #[test]
    fn calculation_get_cells_a1_two_dimensional() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 2,
                sheet_id,
            },
            "test".to_string(),
            None,
            false,
        );

        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "B:".to_string());
        assert!(result.values.unwrap().two_dimensional);

        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "B".to_string());
        assert!(!result.values.unwrap().two_dimensional);

        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "2:".to_string());
        assert!(result.values.unwrap().two_dimensional);

        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "2".to_string());
        assert!(!result.values.unwrap().two_dimensional);

        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "D5:E5".to_string());
        assert!(!result.values.unwrap().two_dimensional);

        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "D5:".to_string());
        assert!(result.values.unwrap().two_dimensional);
    }

    #[test]
    fn test_get_cells_table_headers() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.test_set_code_run_array_2d(sheet_id, 1, 1, 2, 2, vec!["1", "2", "3", "4"]);

        // set show_name and show_column true
        gc.data_table_meta(
            SheetPos::new(sheet_id, 1, 1),
            None,
            None,
            None,
            Some(Some(true)),
            Some(Some(true)),
            None,
            false,
        );

        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 10),
            CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc
            .calculation_get_cells_a1(transaction_id.to_string(), "Table1[[#HEADERS]]".to_string());
        assert_eq!(
            result,
            JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![
                        JsCellsA1Value {
                            x: 1,
                            y: 2,
                            v: "Column 1".into(),
                            t: 1
                        },
                        JsCellsA1Value {
                            x: 2,
                            y: 2,
                            v: "Column 2".into(),
                            t: 1
                        }
                    ],
                    x: 1,
                    y: 2,
                    w: 2,
                    h: 1,
                    one_dimensional: false,
                    two_dimensional: true,
                    has_headers: true,
                }),
                error: None,
            }
        );
    }

    #[test]
    fn test_get_cells_table_data_headers() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.test_set_code_run_array_2d(sheet_id, 1, 1, 2, 1, vec!["1", "2"]);

        // set show_name and show_column true
        gc.data_table_meta(
            SheetPos::new(sheet_id, 1, 1),
            None,
            None,
            None,
            Some(Some(true)),
            Some(Some(true)),
            None,
            false,
        );

        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 10),
            CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result =
            gc.calculation_get_cells_a1(transaction_id.to_string(), "Table1[[#ALL]]".to_string());
        assert_eq!(
            result,
            JsCellsA1Response {
                values: Some(JsCellsA1Values {
                    cells: vec![
                        JsCellsA1Value {
                            x: 1,
                            y: 2,
                            v: "Column 1".into(),
                            t: 1
                        },
                        JsCellsA1Value {
                            x: 2,
                            y: 2,
                            v: "Column 2".into(),
                            t: 1
                        },
                        JsCellsA1Value {
                            x: 1,
                            y: 3,
                            v: "1".into(),
                            t: 2
                        },
                        JsCellsA1Value {
                            x: 2,
                            y: 3,
                            v: "2".into(),
                            t: 2
                        }
                    ],
                    x: 1,
                    y: 2,
                    w: 2,
                    h: 2,
                    one_dimensional: false,
                    two_dimensional: true,
                    has_headers: true,
                }),
                error: None,
            }
        );
    }

    #[test]
    fn test_get_cells_table_python() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.test_set_code_run_array_2d(sheet_id, 1, 1, 2, 2, vec!["1", "2", "3", "4"]);

        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 10),
            CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "Table1".to_string());
        assert!(result.values.is_some());
    }

    #[test]
    fn test_get_cells_table_different_sheet() {
        let mut gc = GridController::test();
        let sheet1_id = gc.sheet_ids()[0];
        gc.add_sheet_with_name("Sheet 2".to_string(), None, false);
        let sheet2_id = gc.sheet_ids()[1];

        // set table in sheet 2
        gc.test_set_code_run_array_2d(sheet1_id, 1, 1, 2, 2, vec!["1", "2", "3", "4"]);

        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id: sheet2_id,
            },
            CodeCellLanguage::Python,
            "".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc.calculation_get_cells_a1(transaction_id.to_string(), "Table1".to_string());
        assert!(result.values.is_some());
    }
}
