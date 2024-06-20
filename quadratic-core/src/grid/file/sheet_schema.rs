use super::current;
use super::v1_5;
use crate::grid::Sheet;
use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Used to serialize a Sheet for use in Operation::AddSheetSchema.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum SheetSchema {
    V1_5(v1_5::schema::Sheet),
}

impl SheetSchema {
    /// Imports a Sheet from the schema.
    pub fn into_latest(&self) -> Result<Sheet> {
        match self {
            SheetSchema::V1_5(sheet) => current::import_sheet(sheet),
        }
    }
}

/// Exports a Sheet to the latest schema version.
pub fn export_sheet(sheet: &Sheet) -> SheetSchema {
    let schema = current::export_sheet(sheet);
    SheetSchema::V1_5(schema)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_export_sheet() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((0, 0).into(), "Hello, world!".to_string());
        sheet.calculate_bounds();
        let schema = export_sheet(&sheet);
        let imported = schema.into_latest().unwrap();
        assert_eq!(sheet, imported);
    }
}
