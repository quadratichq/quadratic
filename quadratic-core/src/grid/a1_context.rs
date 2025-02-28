//! A map of table names and columns to positions on the sheet. This allows
//! JsSelection to properly return positions w/o needing to call into core.

use crate::a1::A1Context;

use super::*;

impl Grid {
    /// Creates an A1Context from the grid for use by rust client (or core).
    pub fn a1_context(&self) -> A1Context {
        let mut context = A1Context::default();
        self.sheets.iter().for_each(|sheet| {
            sheet.add_sheet_to_a1_context(&mut context);
        });
        context
    }
}
