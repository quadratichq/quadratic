use super::current;
use crate::{
    grid::{CodeCellLanguage, ConnectionKind},
    CellValue, CodeCellValue,
};
use bigdecimal::BigDecimal;
use std::str::FromStr;

pub fn export_cell_value(cell_value: &CellValue) -> current::CellValueSchema {
    match cell_value {
        CellValue::Blank => current::CellValueSchema::Blank,
        CellValue::Text(text) => current::CellValueSchema::Text(text.to_owned()),
        CellValue::Number(number) => export_cell_value_number(number.clone()),
        CellValue::Html(html) => current::CellValueSchema::Html(html.to_owned()),
        CellValue::Code(cell_code) => current::CellValueSchema::Code(current::CodeCellSchema {
            code: cell_code.code.to_owned(),
            language: match cell_code.language.clone() {
                CodeCellLanguage::Python => current::CodeCellLanguageSchema::Python,
                CodeCellLanguage::Formula => current::CodeCellLanguageSchema::Formula,
                CodeCellLanguage::Javascript => current::CodeCellLanguageSchema::Javascript,
                CodeCellLanguage::Connection { kind, id } => {
                    current::CodeCellLanguageSchema::Connection {
                        kind: match kind {
                            ConnectionKind::Postgres => current::ConnectionKindSchema::Postgres,
                            ConnectionKind::Mysql => current::ConnectionKindSchema::Mysql,
                            ConnectionKind::Mssql => current::ConnectionKindSchema::Mssql,
                        },
                        id,
                    }
                }
            },
        }),
        CellValue::Logical(logical) => current::CellValueSchema::Logical(*logical),
        CellValue::Instant(instant) => current::CellValueSchema::Instant(instant.to_string()),
        CellValue::Duration(duration) => current::CellValueSchema::Duration(duration.to_string()),
        CellValue::Date(d) => current::CellValueSchema::Date(*d),
        CellValue::Time(t) => current::CellValueSchema::Time(*t),
        CellValue::DateTime(dt) => current::CellValueSchema::DateTime(*dt),
        CellValue::Error(error) => current::CellValueSchema::Error(
            current::RunErrorSchema::from_grid_run_error(*error.clone()),
        ),
        CellValue::Image(image) => current::CellValueSchema::Image(image.clone()),
    }
}

// Change BigDecimal to a current::CellValue (this will be used to convert BD to
// various CellValue::Number* types, such as NumberF32, etc.)
pub fn export_cell_value_number(number: BigDecimal) -> current::CellValueSchema {
    current::CellValueSchema::Number(number.to_string())
}

// Change BigDecimal's serialization to a grid::CellValue (this will be used to
// convert BD to various CellValue::Number* types, such as NumberF32, etc.)
pub fn import_cell_value_number(number: String) -> CellValue {
    CellValue::Number(BigDecimal::from_str(&number).unwrap_or_default())
}

pub fn import_cell_value(value: &current::CellValueSchema) -> CellValue {
    match value {
        current::CellValueSchema::Blank => CellValue::Blank,
        current::CellValueSchema::Text(text) => CellValue::Text(text.to_owned()),
        current::CellValueSchema::Number(number) => import_cell_value_number(number.to_owned()),
        current::CellValueSchema::Html(html) => CellValue::Html(html.to_owned()),
        current::CellValueSchema::Code(code_cell) => CellValue::Code(CodeCellValue {
            code: code_cell.code.to_owned(),
            language: match code_cell.language {
                current::CodeCellLanguageSchema::Python => CodeCellLanguage::Python,
                current::CodeCellLanguageSchema::Formula => CodeCellLanguage::Formula,
                current::CodeCellLanguageSchema::Javascript => CodeCellLanguage::Javascript,
                current::CodeCellLanguageSchema::Connection { ref kind, ref id } => {
                    CodeCellLanguage::Connection {
                        kind: match kind {
                            current::ConnectionKindSchema::Postgres => ConnectionKind::Postgres,
                            current::ConnectionKindSchema::Mysql => ConnectionKind::Mysql,
                            current::ConnectionKindSchema::Mssql => ConnectionKind::Mssql,
                        },
                        id: id.clone(),
                    }
                }
            },
        }),
        current::CellValueSchema::Logical(logical) => CellValue::Logical(*logical),
        current::CellValueSchema::Instant(instant) => {
            CellValue::Instant(serde_json::from_str(instant).unwrap_or_default())
        }
        current::CellValueSchema::Duration(duration) => {
            CellValue::Duration(serde_json::from_str(duration).unwrap_or_default())
        }
        current::CellValueSchema::Date(date) => CellValue::Date(*date),
        current::CellValueSchema::Time(time) => CellValue::Time(*time),
        current::CellValueSchema::DateTime(dt) => CellValue::DateTime(*dt),
        current::CellValueSchema::Error(error) => {
            CellValue::Error(Box::new((*error).clone().into()))
        }
        current::CellValueSchema::Image(text) => CellValue::Image(text.to_owned()),
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{controller::GridController, grid::file, selection::Selection};

    #[test]
    #[parallel]
    fn import_and_export_date_time() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_date_time_format(Selection::pos(0, 0, sheet_id), Some("%H".to_string()), None)
            .unwrap();
        let grid = gc.grid().clone();
        let exported = file::export(grid).unwrap();
        let imported = file::import(exported).unwrap();
        assert_eq!(imported, *gc.grid());
    }
}