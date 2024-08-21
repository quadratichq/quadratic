use std::str::FromStr;

use bigdecimal::BigDecimal;

use super::schema::{self as current};
use crate::grid::{CodeCellLanguage, ConnectionKind};
use crate::{CellValue, CodeCellValue};

pub fn export_cell_value(cell_value: CellValue) -> current::CellValue {
    match cell_value {
        CellValue::Blank => current::CellValue::Blank,
        CellValue::Text(text) => current::CellValue::Text(text),
        CellValue::Number(number) => export_cell_value_number(number),
        CellValue::Html(html) => current::CellValue::Html(html),
        CellValue::Code(cell_code) => current::CellValue::Code(current::CodeCell {
            code: cell_code.code,
            language: match cell_code.language {
                CodeCellLanguage::Python => current::CodeCellLanguage::Python,
                CodeCellLanguage::Formula => current::CodeCellLanguage::Formula,
                CodeCellLanguage::Javascript => current::CodeCellLanguage::Javascript,
                CodeCellLanguage::Connection { kind, id } => {
                    current::CodeCellLanguage::Connection {
                        kind: match kind {
                            ConnectionKind::Postgres => current::ConnectionKind::Postgres,
                            ConnectionKind::Mysql => current::ConnectionKind::Mysql,
                        },
                        id,
                    }
                }
            },
        }),
        CellValue::Logical(logical) => current::CellValue::Logical(logical),
        CellValue::Instant(instant) => current::CellValue::Instant(instant.to_string()),
        CellValue::Duration(duration) => current::CellValue::Duration(duration.to_string()),
        CellValue::Error(error) => {
            current::CellValue::Error(current::RunError::from_grid_run_error(*error))
        }
        CellValue::Image(image) => current::CellValue::Image(image.clone()),
    }
}

// Change BigDecimal to a current::CellValue (this will be used to convert BD to
// various CellValue::Number* types, such as NumberF32, etc.)
pub fn export_cell_value_number(number: BigDecimal) -> current::CellValue {
    current::CellValue::Number(number.to_string())
}

// Change BigDecimal's serialization to a grid::CellValue (this will be used to
// convert BD to various CellValue::Number* types, such as NumberF32, etc.)
pub fn import_cell_value_number(number: String) -> CellValue {
    CellValue::Number(BigDecimal::from_str(&number).unwrap_or_default())
}

pub fn import_cell_value(value: &current::CellValue) -> CellValue {
    match value {
        current::CellValue::Blank => CellValue::Blank,
        current::CellValue::Text(text) => CellValue::Text(text.to_owned()),
        current::CellValue::Number(number) => import_cell_value_number(number.to_owned()),
        current::CellValue::Html(html) => CellValue::Html(html.to_owned()),
        current::CellValue::Code(code_cell) => CellValue::Code(CodeCellValue {
            code: code_cell.code.to_owned(),
            language: match code_cell.language {
                current::CodeCellLanguage::Python => CodeCellLanguage::Python,
                current::CodeCellLanguage::Formula => CodeCellLanguage::Formula,
                current::CodeCellLanguage::Javascript => CodeCellLanguage::Javascript,
                current::CodeCellLanguage::Connection { ref kind, ref id } => {
                    CodeCellLanguage::Connection {
                        kind: match kind {
                            current::ConnectionKind::Postgres => ConnectionKind::Postgres,
                            current::ConnectionKind::Mysql => ConnectionKind::Mysql,
                        },
                        id: id.clone(),
                    }
                }
            },
        }),
        current::CellValue::Logical(logical) => CellValue::Logical(*logical),
        current::CellValue::Instant(instant) => {
            CellValue::Instant(serde_json::from_str(instant).unwrap_or_default())
        }
        current::CellValue::Duration(duration) => {
            CellValue::Duration(serde_json::from_str(duration).unwrap_or_default())
        }
        current::CellValue::Error(error) => CellValue::Error(Box::new((*error).clone().into())),
        current::CellValue::Image(text) => CellValue::Image(text.to_owned()),
    }
}

#[cfg(test)]
mod tests {
    use anyhow::{anyhow, Result};

    use crate::grid::file::v1_5::schema::GridSchema;

    const V1_5_FILE: &str =
        include_str!("../../../../../quadratic-rust-shared/data/grid/v1_5_simple.grid");

    fn import(file_contents: &str) -> Result<GridSchema> {
        serde_json::from_str::<GridSchema>(file_contents)
            .map_err(|e| anyhow!("Could not import file: {:?}", e))
    }

    fn export(grid_schema: &GridSchema) -> Result<String> {
        serde_json::to_string(grid_schema).map_err(|e| anyhow!("Could not export file: {:?}", e))
    }

    #[test]
    fn import_and_export_a_v1_5_file() {
        let imported = import(V1_5_FILE).unwrap();
        let exported = export(&imported).unwrap();
        let imported_copy = import(&exported).unwrap();
        assert_eq!(imported_copy, imported);
    }
}
