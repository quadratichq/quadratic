use super::serialize::sheets::import_sheet;
use super::v1_6;
use super::v1_7;
use super::v1_7_1;
use super::v1_8;
use super::v1_9;
use super::v1_10;
use super::v1_11;
use super::v1_12;
use crate::grid::Sheet;
use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Used to serialize a Sheet for use in Operation::AddSheetSchema.
#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum SheetSchema {
    V1_12(v1_12::SheetSchema),
    V1_11(v1_11::SheetSchema),
    V1_10(v1_10::SheetSchema),
    V1_9(v1_9::SheetSchema),
    V1_8(v1_8::SheetSchema),
    V1_7_1(v1_7_1::SheetSchema),
    V1_7(v1_7::schema::SheetSchema),
    V1_6(v1_6::schema::Sheet),
}

impl SheetSchema {
    /// Imports a Sheet from the schema.
    pub fn into_latest(self) -> Result<Sheet> {
        match self {
            SheetSchema::V1_12(sheet) => import_sheet(sheet),
            SheetSchema::V1_11(sheet) => import_sheet(v1_11::upgrade_sheet(sheet)),
            SheetSchema::V1_10(sheet) => {
                import_sheet(v1_11::upgrade_sheet(v1_10::upgrade_sheet(sheet)))
            }
            SheetSchema::V1_9(sheet) => import_sheet(v1_11::upgrade_sheet(v1_10::upgrade_sheet(
                v1_9::upgrade_sheet(sheet),
            ))),
            SheetSchema::V1_8(sheet) => import_sheet(v1_11::upgrade_sheet(v1_10::upgrade_sheet(
                v1_9::upgrade_sheet(v1_8::upgrade_sheet(sheet)),
            ))),
            SheetSchema::V1_7_1(sheet) => import_sheet(v1_11::upgrade_sheet(v1_10::upgrade_sheet(
                v1_9::upgrade_sheet(v1_8::upgrade_sheet(v1_7_1::upgrade_sheet(sheet))),
            ))),
            SheetSchema::V1_7(sheet) => import_sheet(v1_11::upgrade_sheet(v1_10::upgrade_sheet(
                v1_9::upgrade_sheet(v1_8::upgrade_sheet(v1_7_1::upgrade_sheet(
                    v1_7::upgrade_sheet(sheet),
                ))),
            ))),
            SheetSchema::V1_6(sheet) => import_sheet(v1_11::upgrade_sheet(v1_10::upgrade_sheet(
                v1_9::upgrade_sheet(v1_8::upgrade_sheet(v1_7_1::upgrade_sheet(
                    v1_7::upgrade_sheet(v1_6::file::upgrade_sheet(sheet)?),
                ))),
            ))),
        }
    }
}

/// Exports a Sheet to the latest schema version.
pub fn export_sheet(sheet: Sheet) -> SheetSchema {
    let schema = super::serialize::sheets::export_sheet(sheet);
    SheetSchema::V1_12(schema)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_export_sheet() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((0, 0).into(), "Hello, world!".to_string());
        let schema = export_sheet(sheet.clone());
        let imported = schema.into_latest().unwrap();
        assert_eq!(sheet, imported);
    }
}
