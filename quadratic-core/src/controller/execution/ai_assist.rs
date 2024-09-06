use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::GridController;

use crate::error_core::Result;

use crate::grid::CodeCellLanguage;
use crate::{Pos, SheetPos};

use super::TransactionType;

#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct AICellValue {
    value: String,
    pos: Pos,
}

#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct AICodeCell {
    language: CodeCellLanguage,
    code: String,
    pos: Pos,
}

#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct AIAssistResponse {
    cell_values: Vec<AICellValue>,
    code_cells: Vec<AICodeCell>,
}

impl GridController {
    pub fn set_ai_assist_response(
        &mut self,
        sheet_pos: SheetPos,
        ai_assist_response: AIAssistResponse,
        cursor: Option<String>,
    ) -> Uuid {
        let AIAssistResponse {
            cell_values,
            code_cells,
        } = ai_assist_response;

        let mut ops = vec![];
        for cell_value in cell_values {
            ops.extend(self.set_cell_value_operations(
                SheetPos {
                    x: sheet_pos.x + cell_value.pos.x,
                    y: sheet_pos.y + cell_value.pos.y,
                    sheet_id: sheet_pos.sheet_id,
                },
                cell_value.value,
            ));
        }
        for code_cell in code_cells {
            ops.extend(self.set_code_cell_operations(
                SheetPos {
                    x: sheet_pos.x + code_cell.pos.x,
                    y: sheet_pos.y + code_cell.pos.y,
                    sheet_id: sheet_pos.sheet_id,
                },
                code_cell.language,
                code_cell.code,
            ));
        }

        let mut transaction = PendingTransaction {
            transaction_type: TransactionType::User,
            operations: ops.into(),
            cursor,
            transaction_name: TransactionName::AIAssist,
            ..Default::default()
        };
        self.start_transaction(&mut transaction);
        self.transactions.add_async_transaction(&mut transaction);
        transaction.id
    }

    pub fn confirm_ai_assist_response(&mut self, transaction_id: Uuid, accept: bool) -> Result<()> {
        let transaction = self.transactions.remove_awaiting_async(transaction_id)?;
        if accept {
            self.finalize_transaction(transaction);
        } else {
            let mut transaction = PendingTransaction {
                transaction_type: transaction.transaction_type,
                operations: transaction.reverse_operations.into_iter().rev().collect(),
                cursor: transaction.cursor,
                transaction_name: transaction.transaction_name,
                ..Default::default()
            };
            self.start_transaction(&mut transaction);
        }
        Ok(())
    }
}
