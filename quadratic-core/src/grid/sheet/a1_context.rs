use crate::a1::A1Context;

use super::*;

impl Sheet {
    /// Adds this sheet to the A1Context.
    pub fn add_sheet_to_context(&self, context: &mut A1Context) {
        context.sheet_map.insert(self);
        self.data_tables.iter().for_each(|(pos, table)| {
            if !table.has_error() && !table.spill_error {
                context.table_map.insert(self.id, *pos, table);
            }
        });
    }

    /// Creates an A1Context with information only from this sheet (ie, it does
    /// not have info from other sheets within the grid).
    pub(crate) fn a1_context(&self) -> A1Context {
        let mut context = A1Context::default();
        self.add_sheet_to_context(&mut context);
        context
    }
}
