use crate::{
    a1::A1Context,
    grid::{CodeCellLanguage, DataTableKind},
};

use super::*;

impl Sheet {
    pub fn get_table_language(&self, pos: Pos, table: &DataTable) -> Option<CodeCellLanguage> {
        let language = match table.kind {
            DataTableKind::CodeRun(_) => {
                if let Some(CellValue::Code(code)) = self.cell_value_ref(pos) {
                    Some(code.language.clone())
                } else {
                    None
                }
            }
            DataTableKind::Import(_) => Some(CodeCellLanguage::Import),
        };
        language
    }

    /// Adds this sheet to the A1Context.
    pub fn add_sheet_to_a1_context(&self, context: &mut A1Context) {
        context.sheet_map.insert(self);
        self.data_tables.iter().for_each(|(pos, table)| {
            if let Some(language) = self.get_table_language(*pos, table) {
                context
                    .table_map
                    .insert_table(self.id, *pos, table, language);
            } else {
                dbgjs!(&format!("No language for table at {:?}", pos));
            }
        });
    }

    /// Creates an A1Context with information only from this sheet (ie, it does
    /// not have info from other sheets within the grid).
    pub(crate) fn a1_context(&self) -> A1Context {
        let mut context = A1Context::default();
        self.add_sheet_to_a1_context(&mut context);
        context
    }
}
