use crate::{
    controller::{active_transactions::transaction_name::TransactionName, GridController},
    Pos, SheetPos,
};

use anyhow::{anyhow, Result};

impl GridController {
    pub fn data_tables_within(&self, sheet_pos: SheetPos) -> Result<Vec<Pos>> {
        let sheet = self
            .try_sheet(sheet_pos.sheet_id)
            .ok_or_else(|| anyhow!("Sheet not found"))?;
        let pos = Pos::from(sheet_pos);

        sheet.data_tables_within(pos)
    }

    pub fn flatten_data_table(&mut self, sheet_pos: SheetPos, cursor: Option<String>) {
        let ops = self.flatten_data_table_operations(sheet_pos, cursor.to_owned());
        self.start_user_transaction(ops, cursor, TransactionName::FlattenDataTable);
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {}
