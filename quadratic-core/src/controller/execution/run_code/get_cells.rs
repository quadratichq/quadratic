use uuid::Uuid;

use crate::{controller::GridController, error_core::CoreError, Rect, RunError, RunErrorMsg};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsGetCellResponse {
    pub x: i64,
    pub y: i64,
    pub value: String,
    pub type_name: String,
}

impl GridController {
    /// This is used to get cells during an async calculation.
    #[allow(clippy::result_large_err)]
    #[allow(clippy::too_many_arguments)]
    pub fn calculation_get_cells(
        &mut self,
        transaction_id: String,
        x: i64,
        y: i64,
        w: i64,
        h: Option<i64>,
        sheet_name: Option<String>,
        line_number: Option<u32>,
    ) -> Result<Vec<JsGetCellResponse>, CoreError> {
        let transaction_id = Uuid::parse_str(&transaction_id)
            .map_err(|_| CoreError::TransactionNotFound("Transaction Id is invalid".into()))?;

        let mut transaction = self
            .transactions
            .remove_awaiting_async(transaction_id)
            .map_err(|_| CoreError::TransactionNotFound("Transaction Id not found".into()))?;

        let current_sheet = transaction
            .current_sheet_pos
            .ok_or(CoreError::TransactionNotFound(
                "Transaction's position not found".into(),
            ))?
            .sheet_id;

        // if sheet_name is None, use the sheet_id from the pos
        let sheet = if let Some(sheet_name) = sheet_name {
            if let Some(sheet) = self.try_sheet_from_name(sheet_name.clone()) {
                sheet
            } else {
                // unable to find sheet by name, generate error
                let mut msg = format!("Sheet '{}' not found", sheet_name);
                if let Some(line_number) = line_number {
                    msg = format!("{} at line {}", msg, line_number);
                }
                let run_error = RunError {
                    span: None,
                    msg: RunErrorMsg::CodeRunError(msg.clone().into()),
                };
                let error = match self.code_cell_sheet_error(&mut transaction, &run_error) {
                    Ok(_) => CoreError::CodeCellSheetError(msg.to_owned()),
                    Err(err) => err,
                };

                self.start_transaction(&mut transaction);
                self.finalize_transaction(transaction);

                return Err(error);
            }
        } else if let Some(sheet) = self.try_sheet(current_sheet) {
            sheet
        } else {
            self.start_transaction(&mut transaction);
            self.finalize_transaction(transaction);
            return Err(CoreError::CodeCellSheetError("Sheet not found".to_string()));
        };

        let h = h.unwrap_or(sheet.find_last_data_row(x, y, w));
        let rect = Rect::from_numbers(x, y, w, h);

        if !transaction.is_user_undo_redo() {
            // this should only be called for a user transaction
            return Err(CoreError::TransactionNotFound(
                "getCells can only be called for user / undo-redo transaction".to_string(),
            ));
        }

        let response = sheet.get_cells_response(rect);

        transaction
            .cells_accessed
            .insert(rect.to_sheet_rect(sheet.id));

        self.transactions.add_async_transaction(&mut transaction);

        Ok(response)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{grid::CodeCellLanguage, Pos, Rect, SheetPos};
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_calculation_get_cells_bad_transaction_id() {
        let mut gc = GridController::test();

        let result = gc.calculation_get_cells(
            "bad transaction id".to_string(),
            0,
            0,
            1,
            Some(1),
            None,
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    #[parallel]
    fn test_calculation_get_cells_no_transaction() {
        let mut gc = GridController::test();

        let result =
            gc.calculation_get_cells(Uuid::new_v4().to_string(), 0, 0, 1, Some(1), None, None);
        assert!(result.is_err());
    }

    #[test]
    #[parallel]
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
        let result = gc.calculation_get_cells(transaction_id, 0, 0, 1, Some(1), None, None);
        assert!(result.is_err());
    }

    #[test]
    #[parallel]
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

        let result = gc.calculation_get_cells(
            transaction_id.to_string(),
            0,
            0,
            1,
            Some(1),
            Some("bad sheet name".to_string()),
            None,
        );
        assert!(result.is_err());
        let sheet = gc.sheet(sheet_id);
        let error = sheet
            .code_run(Pos { x: 0, y: 0 })
            .unwrap()
            .clone()
            .std_err
            .unwrap();
        assert!(error.contains("not found"));
    }

    // This was previously disallowed. It is now allowed to unlock appending results.
    // Leaving in some commented out code in case we want to revert this behavior.
    #[test]
    #[parallel]
    fn test_calculation_get_cells_self_reference() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "10".to_string(),
            None,
        );
        // async python
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            crate::grid::CodeCellLanguage::Python,
            "".to_string(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result =
            gc.calculation_get_cells(transaction_id.to_string(), 0, 1, 1, Some(1), None, None);
        assert!(result.is_ok());

        let sheet = gc.sheet(sheet_id);
        let code = sheet.get_render_cells(Rect::from_numbers(0, 1, 1, 1));
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
    #[parallel]
    fn test_calculation_get_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "test".to_string(),
            None,
        );

        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "".to_string(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id;

        let result =
            gc.calculation_get_cells(transaction_id.to_string(), 0, 0, 1, Some(1), None, None);
        assert_eq!(
            result,
            Ok(vec![JsGetCellResponse {
                x: 0,
                y: 0,
                value: "test".into(),
                type_name: "text".into()
            }])
        );
    }

    #[test]
    #[parallel]
    fn calculation_get_cells_with_no_y1() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "test1".to_string(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            "test2".to_string(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 2,
                sheet_id,
            },
            "test3".to_string(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 4,
                sheet_id,
            },
            "test4".to_string(),
            None,
        );

        // create a code cell so we can get a transaction_id
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "".to_string(),
            None,
        );

        let transaction_id = gc.last_transaction().unwrap().id;
        let result =
            gc.calculation_get_cells(transaction_id.to_string(), 0, 0, 1, None, None, None);
        assert_eq!(
            result,
            Ok(vec![
                JsGetCellResponse {
                    x: 0,
                    y: 0,
                    value: "test1".into(),
                    type_name: "text".into()
                },
                JsGetCellResponse {
                    x: 0,
                    y: 1,
                    value: "test2".into(),
                    type_name: "text".into()
                },
                JsGetCellResponse {
                    x: 0,
                    y: 2,
                    value: "test3".into(),
                    type_name: "text".into()
                }
            ])
        );
    }
}
