use crate::{
    controller::{active_transactions::transaction_name::TransactionName, GridController},
    Pos, SheetPos, SheetRect,
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

    pub fn set_data_table_value(
        &mut self,
        sheet_pos: SheetPos,
        value: String,
        cursor: Option<String>,
    ) {
        let ops = self.set_data_table_operations_at(sheet_pos, value);
        self.start_user_transaction(ops, cursor, TransactionName::SetDataTableAt);
    }

    pub fn flatten_data_table(&mut self, sheet_pos: SheetPos, cursor: Option<String>) {
        let ops = self.flatten_data_table_operations(sheet_pos, cursor.to_owned());
        self.start_user_transaction(ops, cursor, TransactionName::FlattenDataTable);
    }

    pub fn grid_to_data_table(&mut self, sheet_rect: SheetRect, cursor: Option<String>) {
        let ops = self.grid_to_data_table_operations(sheet_rect, cursor.to_owned());
        self.start_user_transaction(ops, cursor, TransactionName::GridToDataTable);
    }

    pub fn sort_data_table(
        &mut self,
        sheet_rect: SheetRect,
        column_index: u32,
        sort_order: String,
        cursor: Option<String>,
    ) {
        let ops = self.grid_to_data_table_operations(sheet_rect, cursor.to_owned());
        self.start_user_transaction(ops, cursor, TransactionName::GridToDataTable);
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {}
