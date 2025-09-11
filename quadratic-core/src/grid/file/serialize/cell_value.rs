use super::current;
use crate::{
    CellValue, Duration,
    cellvalue::Import,
    grid::{CodeCellLanguage, CodeCellValue, ConnectionKind},
    number::decimal_from_str,
};
use rust_decimal::Decimal;
use std::str::FromStr;

pub fn export_code_cell_language(language: CodeCellLanguage) -> current::CodeCellLanguageSchema {
    match language {
        CodeCellLanguage::Python => current::CodeCellLanguageSchema::Python,
        CodeCellLanguage::Formula => current::CodeCellLanguageSchema::Formula,
        CodeCellLanguage::Javascript => current::CodeCellLanguageSchema::Javascript,
        CodeCellLanguage::Connection { kind, id } => current::CodeCellLanguageSchema::Connection {
            kind: match kind {
                ConnectionKind::Postgres => current::ConnectionKindSchema::Postgres,
                ConnectionKind::Mysql => current::ConnectionKindSchema::Mysql,
                ConnectionKind::Mssql => current::ConnectionKindSchema::Mssql,
                ConnectionKind::Snowflake => current::ConnectionKindSchema::Snowflake,
                ConnectionKind::Cockroachdb => current::ConnectionKindSchema::Cockroachdb,
                ConnectionKind::Bigquery => current::ConnectionKindSchema::Bigquery,
                ConnectionKind::Mariadb => current::ConnectionKindSchema::Mariadb,
                ConnectionKind::Supabase => current::ConnectionKindSchema::Supabase,
                ConnectionKind::Neon => current::ConnectionKindSchema::Neon,
                ConnectionKind::Synced => current::ConnectionKindSchema::Synced,
            },
            id,
        },
        CodeCellLanguage::Import => current::CodeCellLanguageSchema::Import,
    }
}

pub fn export_cell_value(cell_value: CellValue) -> current::CellValueSchema {
    match cell_value {
        CellValue::Blank => current::CellValueSchema::Blank,
        CellValue::Text(text) => current::CellValueSchema::Text(text),
        CellValue::Number(number) => export_cell_value_number(number),
        CellValue::Html(html) => current::CellValueSchema::Html(html),
        CellValue::Code(cell_code) => current::CellValueSchema::Code(current::CodeCellSchema {
            code: cell_code.code,
            language: export_code_cell_language(cell_code.language),
        }),
        CellValue::Logical(logical) => current::CellValueSchema::Logical(logical),
        CellValue::Instant(instant) => current::CellValueSchema::Instant(instant.to_string()),
        CellValue::Duration(duration) => current::CellValueSchema::Duration(duration.to_string()),
        CellValue::Date(d) => current::CellValueSchema::Date(d),
        CellValue::Time(t) => current::CellValueSchema::Time(t),
        CellValue::DateTime(dt) => current::CellValueSchema::DateTime(dt),
        CellValue::Error(error) => {
            current::CellValueSchema::Error(current::RunErrorSchema::from_grid_run_error(*error))
        }
        CellValue::Image(image) => current::CellValueSchema::Image(image),
        CellValue::Import(import) => current::CellValueSchema::Import(current::ImportSchema {
            file_name: import.file_name,
        }),
    }
}

// Change Decimal to a current::CellValue (this will be used to convert BD to
// various CellValue::Number* types, such as NumberF32, etc.)
pub fn export_cell_value_number(number: Decimal) -> current::CellValueSchema {
    current::CellValueSchema::Number(number.to_string())
}

// Change Decimal's serialization to a grid::CellValue (this will be used to
// convert BD to various CellValue::Number* types, such as NumberF32, etc.)
pub fn import_cell_value_number(number: String) -> CellValue {
    CellValue::Number(decimal_from_str(&number).unwrap_or_default())
}

pub fn import_code_cell_language(language: current::CodeCellLanguageSchema) -> CodeCellLanguage {
    match language {
        current::CodeCellLanguageSchema::Python => CodeCellLanguage::Python,
        current::CodeCellLanguageSchema::Formula => CodeCellLanguage::Formula,
        current::CodeCellLanguageSchema::Javascript => CodeCellLanguage::Javascript,
        current::CodeCellLanguageSchema::Connection { kind, id } => CodeCellLanguage::Connection {
            kind: match kind {
                current::ConnectionKindSchema::Postgres => ConnectionKind::Postgres,
                current::ConnectionKindSchema::Mysql => ConnectionKind::Mysql,
                current::ConnectionKindSchema::Mssql => ConnectionKind::Mssql,
                current::ConnectionKindSchema::Snowflake => ConnectionKind::Snowflake,
                current::ConnectionKindSchema::Cockroachdb => ConnectionKind::Cockroachdb,
                current::ConnectionKindSchema::Bigquery => ConnectionKind::Bigquery,
                current::ConnectionKindSchema::Mariadb => ConnectionKind::Mariadb,
                current::ConnectionKindSchema::Supabase => ConnectionKind::Supabase,
                current::ConnectionKindSchema::Neon => ConnectionKind::Neon,
                current::ConnectionKindSchema::Synced => ConnectionKind::Synced,
            },
            id,
        },
        current::CodeCellLanguageSchema::Import => CodeCellLanguage::Import,
    }
}

pub fn import_cell_value(value: current::CellValueSchema) -> CellValue {
    match value {
        current::CellValueSchema::Blank => CellValue::Blank,
        current::CellValueSchema::Text(text) => CellValue::Text(text),
        current::CellValueSchema::Number(number) => import_cell_value_number(number),
        current::CellValueSchema::Html(html) => CellValue::Html(html),
        current::CellValueSchema::Code(code_cell) => CellValue::Code(CodeCellValue {
            code: code_cell.code,
            language: import_code_cell_language(code_cell.language),
        }),
        current::CellValueSchema::Logical(logical) => CellValue::Logical(logical),
        current::CellValueSchema::Instant(instant) => {
            CellValue::Instant(serde_json::from_str(&instant).unwrap_or_default())
        }
        current::CellValueSchema::Duration(duration) => {
            CellValue::Duration(Duration::from_str(&duration).unwrap_or_default())
        }
        current::CellValueSchema::Date(date) => CellValue::Date(date),
        current::CellValueSchema::Time(time) => CellValue::Time(time),
        current::CellValueSchema::DateTime(dt) => CellValue::DateTime(dt),
        current::CellValueSchema::Error(error) => CellValue::Error(Box::new(error.into())),
        current::CellValueSchema::Image(text) => CellValue::Image(text),
        current::CellValueSchema::Import(current::ImportSchema { file_name }) => {
            CellValue::Import(Import::new(file_name))
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{a1::A1Selection, controller::GridController, grid::file};

    #[test]
    fn test_import_and_export_date_time() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_date_time_format(&A1Selection::test_a1("A1"), Some("%H".to_string()), None)
            .unwrap();
        let grid = gc.grid().clone();
        let exported = file::export(grid).unwrap();
        let imported = file::import(exported).unwrap();
        assert_eq!(imported, *gc.grid());
    }
}
