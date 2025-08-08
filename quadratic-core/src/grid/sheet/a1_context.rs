use crate::{MultiPos, SheetPos, TablePos, a1::A1Context};

use super::*;

impl Sheet {
    /// Adds this sheet to the A1Context.
    pub fn add_sheet_to_a1_context(&self, context: &mut A1Context) {
        context.sheet_map.insert(self);
        self.data_tables.expensive_iter().for_each(|(pos, table)| {
            let table_sheet_pos = SheetPos::new(self.id, pos.x, pos.y);
            let multi_pos = MultiPos::SheetPos(table_sheet_pos);
            context.table_map.insert_table(multi_pos, *pos, table);

            // Create the A1Context for any code tables within this data table.
            if table.is_data_table()
                && let Some(tables) = &table.tables {
                    tables.expensive_iter().for_each(|(pos, code_table)| {
                        let multi_pos = MultiPos::TablePos(TablePos::new(table_sheet_pos, *pos));
                        context.table_map.insert_table(multi_pos, *pos, code_table);
                    });
                }
        });
    }

    /// Creates an A1Context with information only from this sheet (ie, it does
    /// not have info from other sheets within the grid).
    #[cfg(test)]
    pub(crate) fn expensive_make_a1_context(&self) -> A1Context {
        let mut context = A1Context::default();
        self.add_sheet_to_a1_context(&mut context);
        context
    }
}
