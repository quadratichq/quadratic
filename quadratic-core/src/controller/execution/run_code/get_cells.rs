use uuid::Uuid;

use crate::{
    controller::{
        execution::TransactionType, transaction_summary::TransactionSummary,
        transaction_types::JsComputeGetCells, GridController,
    },
    error_core::CoreError,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct GetCellResponse {
    pub x: i64,
    pub y: i64,
    pub value: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct GetCellsResponse {
    pub response: Vec<GetCellResponse>,
}

impl GridController {
    /// This is used to get cells during a  async calculation.
    #[allow(clippy::result_large_err)]
    pub fn calculation_get_cells(
        &mut self,
        get_cells: JsComputeGetCells,
    ) -> Result<GetCellsResponse, TransactionSummary> {
        let Ok(transaction_id) = Uuid::parse_str(&get_cells.transaction_id()) else {
            return Err(TransactionSummary::error(CoreError::TransactionNotFound(
                "Transaction Id is invalid".into(),
            )));
        };
        let Ok(mut transaction) = self.transactions.remove_awaiting_async(transaction_id) else {
            return Err(TransactionSummary::error(CoreError::TransactionNotFound(
                "Transaction Id not found".into(),
            )));
        };

        let (current_sheet, pos) = if let Some(current_sheet_pos) = transaction.current_sheet_pos {
            (current_sheet_pos.sheet_id, current_sheet_pos.into())
        } else {
            return Err(TransactionSummary::error(CoreError::TransactionNotFound(
                "Transaction's position not found".to_string(),
            )));
        };

        // if sheet_name is None, use the sheet_id from the pos
        let sheet = if let Some(sheet_name) = get_cells.sheet_name() {
            if let Some(sheet) = self.try_sheet_from_name(sheet_name.clone()) {
                sheet
            } else {
                // unable to find sheet by name, generate error
                let msg = if let Some(line_number) = get_cells.line_number() {
                    format!("Sheet '{}' not found at line {}", sheet_name, line_number)
                } else {
                    format!("Sheet '{}' not found", sheet_name)
                };
                match self.code_cell_sheet_error(&mut transaction, msg, get_cells.line_number()) {
                    Ok(_) => {
                        self.start_transaction(&mut transaction);
                        return Err(self.finalize_transaction(&mut transaction));
                    }
                    Err(err) => {
                        self.start_transaction(&mut transaction);
                        let mut summary = self.finalize_transaction(&mut transaction);
                        summary.error = Some(err);
                        return Err(summary);
                    }
                }
            }
        } else if let Some(sheet) = self.try_sheet(current_sheet) {
            sheet
        } else {
            self.start_transaction(&mut transaction);
            return Err(self.finalize_transaction(&mut transaction));
        };

        let transaction_type = transaction.transaction_type.clone();
        if transaction_type != TransactionType::User {
            // this should only be called for a user transaction
            return Err(TransactionSummary::error(CoreError::TransactionNotFound(
                "getCells can only be called for non-user transaction".to_string(),
            )));
        }
        // ensure that the current cell ref is not in the get_cells request
        if get_cells.rect().contains(pos) && sheet.id == current_sheet {
            // unable to find sheet by name, generate error
            let msg = if let Some(line_number) = get_cells.line_number() {
                format!("cell cannot reference itself at line {}", line_number)
            } else {
                "cell cannot reference itself".to_string()
            };
            match self.code_cell_sheet_error(&mut transaction, msg, get_cells.line_number()) {
                Ok(_) => {
                    self.start_transaction(&mut transaction);
                    return Err(self.finalize_transaction(&mut transaction));
                }
                Err(err) => {
                    self.start_transaction(&mut transaction);
                    let mut summary = self.finalize_transaction(&mut transaction);
                    summary.error = Some(err);
                    return Err(summary);
                }
            }
        }

        let rect = get_cells.rect();
        let response = sheet.get_cells_response(rect);
        transaction
            .cells_accessed
            .insert(rect.to_sheet_rect(sheet.id));
        self.transactions.add_async_transaction(&transaction);
        Ok(response)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        grid::{js_types::JsRenderCellSpecial, CodeCellLanguage},
        Pos, Rect, SheetPos,
    };

    #[test]
    fn test_calculation_get_cells_bad_transaction_id() {
        let mut gc = GridController::test();

        let result = gc.calculation_get_cells(JsComputeGetCells::new(
            "bad transaction id".to_string(),
            Rect::from_numbers(0, 0, 1, 1),
            None,
            None,
        ));
        assert!(result.is_err());
    }

    #[test]
    fn test_calculation_get_cells_no_transaction() {
        let mut gc = GridController::test();

        let result = gc.calculation_get_cells(JsComputeGetCells::new(
            Uuid::new_v4().to_string(),
            Rect::from_numbers(0, 0, 1, 1),
            None,
            None,
        ));
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
        let result = gc.calculation_get_cells(JsComputeGetCells::new(
            transaction_id,
            Rect::from_numbers(0, 0, 1, 1),
            None,
            None,
        ));
        assert!(result.is_err());
    }

    #[test]
    fn test_calculation_get_cells_sheet_name_not_found() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let transaction_id = gc
            .set_code_cell(
                SheetPos {
                    x: 0,
                    y: 0,
                    sheet_id,
                },
                CodeCellLanguage::Python,
                "".to_string(),
                None,
            )
            .transaction_id
            .unwrap();

        let result = gc.calculation_get_cells(JsComputeGetCells::new(
            transaction_id,
            Rect::from_numbers(0, 0, 1, 1),
            Some("bad sheet name".to_string()),
            None,
        ));
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

    #[test]
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
        let summary = gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            crate::grid::CodeCellLanguage::Python,
            "".to_string(),
            None,
        );

        let result = gc.calculation_get_cells(JsComputeGetCells::new(
            summary.transaction_id.unwrap(),
            Rect::from_numbers(0, 1, 1, 1),
            None,
            None,
        ));
        assert!(result.is_err());

        let sheet = gc.sheet(sheet_id);
        let code = sheet.get_render_cells(Rect::from_numbers(0, 1, 1, 1));
        assert_eq!(code.len(), 1);
        assert_eq!(code[0].special, Some(JsRenderCellSpecial::RunError));
        let sheet = gc.sheet(sheet_id);
        let error = sheet
            .code_run(Pos { x: 0, y: 1 })
            .unwrap()
            .clone()
            .std_err
            .unwrap();
        assert!(error.contains("cell cannot reference"));
    }

    #[test]
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

        let transaction_id = gc
            .set_code_cell(
                SheetPos {
                    x: 1,
                    y: 1,
                    sheet_id,
                },
                CodeCellLanguage::Python,
                "".to_string(),
                None,
            )
            .transaction_id
            .unwrap();
        let result = gc.calculation_get_cells(JsComputeGetCells::new(
            transaction_id,
            Rect::from_numbers(0, 0, 1, 1),
            None,
            None,
        ));
        assert_eq!(
            result,
            Ok(GetCellsResponse {
                response: vec![GetCellResponse {
                    x: 0,
                    y: 0,
                    value: "test".into()
                }]
            })
        );
    }
}
