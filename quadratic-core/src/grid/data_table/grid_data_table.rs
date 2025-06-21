use anyhow::{Result, anyhow};

use crate::{
    Pos, SheetPos,
    a1::A1Context,
    grid::{DataTable, Grid, SheetId, unique_data_table_name},
};

impl Grid {
    /// Returns the data table at the given position.
    pub fn data_table_at(&self, sheet_id: SheetId, pos: &Pos) -> Result<&DataTable> {
        self.try_sheet_result(sheet_id)?.data_table_result(pos)
    }

    /// Updates the name of a data table and replaces the old name in all code cells that reference it.
    pub fn update_data_table_name(
        &mut self,
        sheet_pos: SheetPos,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
        require_number: bool,
    ) -> Result<()> {
        let unique_name =
            unique_data_table_name(new_name, require_number, Some(sheet_pos.into()), a1_context);

        self.replace_table_name_in_code_cells(old_name, &unique_name, a1_context);

        let sheet = self
            .try_sheet_mut(sheet_pos.sheet_id)
            .ok_or_else(|| anyhow!("Sheet {} not found", sheet_pos.sheet_id))?;

        sheet.modify_data_table_at(&sheet_pos.into(), |dt| {
            dt.update_table_name(&unique_name);
            Ok(())
        })?;

        Ok(())
    }

    /// Returns a unique name for a data table
    pub fn next_data_table_name(&self, a1_context: &A1Context) -> String {
        unique_data_table_name("Table", true, None, a1_context)
    }

    /// Replaces the table name in all code cells that reference the old name in all sheets in the grid.
    pub fn replace_table_name_in_code_cells(
        &mut self,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        for sheet in self.sheets.values_mut() {
            sheet.replace_table_name_in_code_cells(old_name, new_name, a1_context);
        }
    }

    /// Replaces the column name in all code cells that reference the old name in all sheets in the grid.
    pub fn replace_table_column_name_in_code_cells(
        &mut self,
        table_name: &str,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        for sheet in self.sheets.values_mut() {
            sheet.replace_table_column_name_in_code_cells(
                table_name, old_name, new_name, a1_context,
            );
        }
    }
}
