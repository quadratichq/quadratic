use ts_rs::TS;
use uuid::Uuid;

use crate::{
    controller::GridController, error_core::CoreError, CellRefRange, RunError, RunErrorMsg,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct CellA1Response {
    pub cells: Vec<JsGetCellResponse>,
    pub x: i64,
    pub y: i64,
    pub w: i64,
    pub h: i64,
    pub two_dimensional: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
pub struct JsGetCellResponse {
    pub x: i64,
    pub y: i64,
    pub value: String,
    pub type_name: String,
}

impl GridController {
    /// This is used to get cells during an async calculation.
    pub fn calculation_get_cells_a1(
        &mut self,
        transaction_id: String,
        a1: String,
        line_number: Option<u32>,
    ) -> Result<CellA1Response, CoreError> {
        let transaction_id = Uuid::parse_str(&transaction_id)
            .map_err(|_| CoreError::TransactionNotFound("Transaction Id is invalid".into()))?;

        let mut transaction = self
            .transactions
            .remove_awaiting_async(transaction_id)
            .map_err(|_| CoreError::TransactionNotFound("Transaction Id not found".into()))?;

        if !transaction.is_user_undo_redo() {
            self.start_transaction(&mut transaction);
            self.finalize_transaction(transaction);
            return Err(CoreError::TransactionNotFound(
                "getCells can only be called for user / undo-redo transaction".to_string(),
            ));
        }

        let current_sheet_pos =
            transaction
                .current_sheet_pos
                .ok_or(CoreError::TransactionNotFound(
                    "Transaction's position not found".into(),
                ))?;

        let get_run_error = |msg: &str| -> RunError {
            let mut msg = msg.to_owned();
            if let Some(line_number) = line_number {
                msg = format!("{} at line {}", msg, line_number);
            }
            RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError(msg.into()),
            }
        };

        let selection = match self.a1_selection_from_string(&a1, &current_sheet_pos.sheet_id) {
            Ok(selection) => selection,
            Err(e) => {
                // unable to parse A1 string
                let msg = e.to_string();
                let run_error = get_run_error(&msg);
                let error = match self.code_cell_sheet_error(&mut transaction, &run_error) {
                    Ok(_) => CoreError::A1Error(msg),
                    Err(err) => err,
                };
                self.start_transaction(&mut transaction);
                self.finalize_transaction(transaction);
                return Err(error);
            }
        };

        if selection.sheet_id == current_sheet_pos.sheet_id
            && selection.might_contain_pos(current_sheet_pos.into())
        {
            // self reference not allowed
            let msg = "Self reference not allowed".to_string();
            let run_error = get_run_error(&msg);
            let error = match self.code_cell_sheet_error(&mut transaction, &run_error) {
                Ok(_) => CoreError::A1Error(msg),
                Err(err) => err,
            };
            self.start_transaction(&mut transaction);
            self.finalize_transaction(transaction);
            return Err(error);
        }

        let sheet = match self.try_sheet(selection.sheet_id) {
            Some(sheet) => sheet,
            None => {
                // sheet not found
                let msg = "Sheet not found".to_string();
                let run_error = get_run_error(&msg);
                let error = match self.code_cell_sheet_error(&mut transaction, &run_error) {
                    Ok(_) => CoreError::CodeCellSheetError(msg),
                    Err(err) => err,
                };
                self.start_transaction(&mut transaction);
                self.finalize_transaction(transaction);
                return Err(error);
            }
        };

        let rects = sheet.selection_to_rects(&selection);
        if rects.len() > 1 {
            // multiple rects not supported
            let msg = "Multiple rects not supported".to_string();
            let run_error = get_run_error(&msg);
            let error = match self.code_cell_sheet_error(&mut transaction, &run_error) {
                Ok(_) => CoreError::A1Error(msg),
                Err(err) => err,
            };
            self.start_transaction(&mut transaction);
            self.finalize_transaction(transaction);
            return Err(error);
        }

        selection.ranges.iter().for_each(|range| {
            transaction.cells_accessed.add(sheet.id, range.clone());
        });

        let response = if let Some(rect) = rects.first() {
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
                    CellRefRange::Table { .. } => todo!(),
                }
            } else {
                false
            };

            let cells = sheet.get_cells_response(*rect);
            CellA1Response {
                cells,
                x: rect.min.x,
                y: rect.min.y,
                w: rect.width() as i64,
                h: rect.height() as i64,
                two_dimensional,
            }
        } else {
            CellA1Response {
                cells: vec![],
                x: 1,
                y: 1,
                w: 0,
                h: 0,
                two_dimensional: false,
            }
        };

        self.transactions.add_async_transaction(&mut transaction);

        Ok(response)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod test {
    use super::*;
    use crate::{grid::CodeCellLanguage, Pos, Rect, SheetPos};

    #[test]
    fn test_calculation_get_cells_bad_transaction_id() {
        let mut gc = GridController::test();

        let result =
            gc.calculation_get_cells_a1("bad transaction id".to_string(), "A1".to_string(), None);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculation_get_cells_no_transaction() {
        let mut gc = GridController::test();

        let result =
            gc.calculation_get_cells_a1(Uuid::new_v4().to_string(), "A1".to_string(), None);
        assert!(result.is_err());
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
        );

        let transactions = gc.transactions.async_transactions_mut();
        transactions[0].current_sheet_pos = None;
        let transaction_id = transactions[0].id.to_string();
        let result = gc.calculation_get_cells_a1(transaction_id, "A1".to_string(), None);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculation_get_cells_sheet_name_not_found() {
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
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result = gc.calculation_get_cells_a1(
            transaction_id.to_string(),
            "'bad sheet name'!A1".to_string(),
            None,
        );
        assert!(result.is_err());
        let sheet = gc.sheet(sheet_id);
        let error = sheet
            .data_table(Pos { x: 0, y: 0 })
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
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result =
            gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string(), None);
        assert!(result.is_ok());

        let sheet = gc.sheet(sheet_id);
        let code = sheet.get_render_cells(Rect::from_numbers(2, 1, 1, 1));
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
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result =
            gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string(), None);
        assert_eq!(
            result,
            Ok(CellA1Response {
                cells: vec![JsGetCellResponse {
                    x: 1,
                    y: 1,
                    value: "test".into(),
                    type_name: "text".into()
                }],
                x: 1,
                y: 1,
                w: 1,
                h: 1,
                two_dimensional: false,
            })
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
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "test2".to_string(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 3,
                sheet_id,
            },
            "test3".to_string(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 5,
                sheet_id,
            },
            "test4".to_string(),
            None,
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
        );

        let transaction_id = gc.last_transaction().unwrap().id;
        let result =
            gc.calculation_get_cells_a1(transaction_id.to_string(), "A1:A".to_string(), None);
        assert_eq!(
            result,
            Ok(CellA1Response {
                cells: vec![
                    JsGetCellResponse {
                        x: 1,
                        y: 1,
                        value: "test1".into(),
                        type_name: "text".into()
                    },
                    JsGetCellResponse {
                        x: 1,
                        y: 2,
                        value: "test2".into(),
                        type_name: "text".into()
                    },
                    JsGetCellResponse {
                        x: 1,
                        y: 3,
                        value: "test3".into(),
                        type_name: "text".into()
                    },
                    JsGetCellResponse {
                        x: 1,
                        y: 4,
                        value: "".into(),
                        type_name: "blank".into()
                    },
                    JsGetCellResponse {
                        x: 1,
                        y: 5,
                        value: "test4".into(),
                        type_name: "text".into()
                    }
                ],
                x: 1,
                y: 1,
                w: 1,
                h: 5,
                two_dimensional: false,
            })
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
        );

        gc.set_code_cell(
            SheetPos::new(sheet_id, 2, 2),
            CodeCellLanguage::Javascript,
            "".to_string(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result =
            gc.calculation_get_cells_a1(transaction_id.to_string(), "A1".to_string(), None);
        assert_eq!(
            result,
            Ok(CellA1Response {
                cells: vec![JsGetCellResponse {
                    x: 1,
                    y: 1,
                    value: "test".into(),
                    type_name: "text".into()
                }],
                x: 1,
                y: 1,
                w: 1,
                h: 1,
                two_dimensional: false,
            })
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
        );

        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Python,
            "".to_string(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;
        let result = gc
            .calculation_get_cells_a1(transaction_id.to_string(), "B:".to_string(), None)
            .unwrap();
        assert_eq!(result.two_dimensional, true);

        let result = gc
            .calculation_get_cells_a1(transaction_id.to_string(), "B".to_string(), None)
            .unwrap();
        assert_eq!(result.two_dimensional, false);

        let result = gc
            .calculation_get_cells_a1(transaction_id.to_string(), "2:".to_string(), None)
            .unwrap();
        assert_eq!(result.two_dimensional, true);

        let result = gc
            .calculation_get_cells_a1(transaction_id.to_string(), "2".to_string(), None)
            .unwrap();
        assert_eq!(result.two_dimensional, false);

        let result = gc
            .calculation_get_cells_a1(transaction_id.to_string(), "D5:E5".to_string(), None)
            .unwrap();
        assert_eq!(result.two_dimensional, false);

        let result = gc
            .calculation_get_cells_a1(transaction_id.to_string(), "D5:".to_string(), None)
            .unwrap();
        assert_eq!(result.two_dimensional, true);
    }
}
