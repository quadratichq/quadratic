use crate::{MultiPos, TablePos, a1::A1Context};

use super::*;

impl Sheet {
    /// Adds this sheet to the A1Context.
    pub fn add_sheet_to_a1_context(&self, context: &mut A1Context) {
        context.sheet_map.insert(self);
        self.data_tables
            .expensive_iter()
            .for_each(|(data_table_pos, data_table)| {
                context.table_map.insert_table(
                    data_table_pos.to_multi_sheet_pos(self.id),
                    *data_table_pos,
                    data_table,
                );

                // Create the A1Context for any code tables within this data table.
                if data_table.is_data_table()
                    && let Some(tables) = &data_table.tables
                {
                    tables.expensive_iter().for_each(|(pos, code_table)| {
                        let multi_pos = MultiPos::TablePos(TablePos::new(*data_table_pos, *pos));
                        let translated_pos =
                            pos.translate(data_table_pos.x, data_table_pos.y, 1, 1);
                        context.table_map.insert_table(
                            multi_pos.to_multi_sheet_pos(self.id),
                            translated_pos,
                            code_table,
                        );
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
