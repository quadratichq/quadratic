use crate::a1::A1Context;

use super::*;

impl Sheet {
    /// Adds this sheet to the A1Context.
    pub(crate) fn add_sheet_to_a1_context(&self, context: &mut A1Context) {
        context.sheet_map.insert(self);
        self.data_tables.expensive_iter().for_each(|(pos, table)| {
            context.table_map.insert_table(self.id, *pos, table);
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
