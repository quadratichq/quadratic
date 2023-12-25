use crate::controller::{transaction_summary::TransactionSummary, GridController, Transaction};

use super::TransactionType;

impl GridController {
    pub fn received_transaction(
        &mut self,
        sequence_num: u64,
        transaction: String,
    ) -> TransactionSummary {
        if let Ok(transaction) = serde_json::from_str(&transaction) {
            self.apply_received_transaction(sequence_num, transaction)
        } else {
            panic!("Unable to unpack multiplayer transaction");
        }
    }

    pub fn apply_received_transaction(
        &mut self,
        sequence_num: u64,
        transaction: Transaction,
    ) -> TransactionSummary {
        let existing = self
            .unsaved_transactions
            .iter_mut()
            .enumerate()
            .find(|t| t.1.id == transaction.id);
        if let Some((index, transaction)) = existing {
            // if transaction is the top of the unsaved_transactions, then only need to set the sequence_num
            if index == 0 {
                transaction.sequence_num = Some(sequence_num);
                self.unsaved_transactions.remove(index);

                // nothing to render as we've already rendered this transaction
                return TransactionSummary::default();
            } else {
                todo!(
                    "Handle received transactions that are out of order with current transaction."
                );
            }
        }
        if self.unsaved_transactions.len() > 0 {
            // need to undo unsaved_transactions and then reapply them after the current transaction comes through
        }
        self.start_transaction(transaction.operations, None, TransactionType::Multiplayer);
        self.transaction_updated_bounds();
        let mut summary = self.prepare_transaction_summary();
        summary.generate_thumbnail = false;
        summary.transaction = None;
        summary.save = false;
        summary
    }
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, CellValue, Pos, SheetPos};

    #[test]
    fn test_multiplayer_hello_world() {
        let mut gc1 = GridController::new();
        let sheet_id = gc1.sheet_ids()[0];
        let summary = gc1.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "Hello World".to_string(),
            None,
        );
        let sheet = gc1.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );

        // received its own transaction back...
        gc1.received_transaction(1, summary.transaction.clone().unwrap());
        let sheet = gc1.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );

        let mut gc2 = GridController::new();
        gc2.grid_mut().sheets_mut()[0].id = sheet_id;
        gc2.received_transaction(1, summary.transaction.unwrap());
        let sheet = gc2.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("Hello World".to_string()))
        );
    }
}
