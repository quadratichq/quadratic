use super::current;
use super::data_table::{export_code_run, import_code_run_builder};
use crate::{
    CellValue, CodeCell, Duration,
    cellvalue::{Import, TextSpan},
    grid::{CodeCellLanguage, ConnectionKind},
    number::decimal_from_str,
};
use anyhow::Result;
use chrono::{DateTime, TimeZone, Utc};
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
                ConnectionKind::Mixpanel => current::ConnectionKindSchema::Mixpanel,
                ConnectionKind::GoogleAnalytics => current::ConnectionKindSchema::GoogleAnalytics,
                ConnectionKind::Plaid => current::ConnectionKindSchema::Plaid,
                ConnectionKind::StockHistory => current::ConnectionKindSchema::StockHistory,
            },
            id,
        },
        CodeCellLanguage::Import => current::CodeCellLanguageSchema::Import,
    }
}

fn export_text_span(span: TextSpan) -> current::TextSpanSchema {
    current::TextSpanSchema {
        text: span.text,
        link: span.link,
        bold: span.bold,
        italic: span.italic,
        underline: span.underline,
        strike_through: span.strike_through,
        text_color: span.text_color,
        font_size: span.font_size,
    }
}

fn import_text_span(span: current::TextSpanSchema) -> TextSpan {
    TextSpan {
        text: span.text,
        link: span.link,
        bold: span.bold,
        italic: span.italic,
        underline: span.underline,
        strike_through: span.strike_through,
        text_color: span.text_color,
        font_size: span.font_size,
    }
}

pub fn export_cell_value(cell_value: CellValue) -> current::CellValueSchema {
    match cell_value {
        CellValue::Blank => current::CellValueSchema::Blank,
        CellValue::Text(text) => current::CellValueSchema::Text(text),
        CellValue::Number(number) => export_cell_value_number(number),
        CellValue::Html(html) => current::CellValueSchema::Html(html),
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
        CellValue::RichText(spans) => {
            current::CellValueSchema::RichText(spans.into_iter().map(export_text_span).collect())
        }
        CellValue::Code(code_cell) => {
            current::CellValueSchema::Code(Box::new(current::SingleCodeCellSchema {
                code_run: export_code_run(code_cell.code_run),
                output: export_cell_value(*code_cell.output),
                last_modified: code_cell.last_modified.timestamp_millis(),
            }))
        }
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
                current::ConnectionKindSchema::Mixpanel => ConnectionKind::Mixpanel,
                current::ConnectionKindSchema::GoogleAnalytics => ConnectionKind::GoogleAnalytics,
                current::ConnectionKindSchema::Plaid => ConnectionKind::Plaid,
                current::ConnectionKindSchema::StockHistory => ConnectionKind::StockHistory,
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
        current::CellValueSchema::RichText(spans) => {
            CellValue::RichText(spans.into_iter().map(import_text_span).collect())
        }
        current::CellValueSchema::Code(code_cell) => {
            import_code_cell(*code_cell).unwrap_or_else(|e| {
                dbgjs!(format!("Failed to import code cell: {e}"));
                CellValue::Blank
            })
        }
    }
}

/// Import a code cell from the schema. Returns a Result since code run parsing can fail.
fn import_code_cell(code_cell: current::SingleCodeCellSchema) -> Result<CellValue> {
    let code_run = import_code_run_builder(code_cell.code_run)?;
    let output = import_cell_value(code_cell.output);
    let last_modified = Utc
        .timestamp_millis_opt(code_cell.last_modified)
        .single()
        .unwrap_or_else(|| {
            dbgjs!(format!(
                "Failed to parse last_modified timestamp: {}",
                code_cell.last_modified
            ));
            Utc::now()
        });
    Ok(CellValue::Code(Box::new(CodeCell {
        code_run,
        output: Box::new(output),
        last_modified,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{a1::A1Selection, controller::GridController, grid::file};

    #[test]
    fn test_import_and_export_date_time() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_date_time_format(
            &A1Selection::test_a1("A1"),
            Some("%H".to_string()),
            None,
            false,
        )
        .unwrap();
        let grid = gc.grid().clone();
        let exported = file::export(grid).unwrap();
        let imported = file::import(exported).unwrap();
        assert_eq!(imported, *gc.grid());
    }

    #[test]
    fn test_export_text_span() {
        let span = TextSpan {
            text: "Hello".to_string(),
            link: Some("https://example.com".to_string()),
            bold: Some(true),
            italic: None,
            underline: None,
            strike_through: None,
            text_color: Some("#ff0000".to_string()),
            font_size: Some(14),
        };

        let exported = export_text_span(span.clone());
        assert_eq!(exported.text, "Hello");
        assert_eq!(exported.link, Some("https://example.com".to_string()));
        assert_eq!(exported.bold, Some(true));
        assert_eq!(exported.italic, None);
        assert_eq!(exported.text_color, Some("#ff0000".to_string()));
        assert_eq!(exported.font_size, Some(14));

        let imported = import_text_span(exported);
        assert_eq!(imported, span);
    }

    #[test]
    fn test_export_rich_text_cell_value() {
        let rich = CellValue::RichText(vec![
            TextSpan::plain("Normal "),
            TextSpan::link("link", "https://example.com"),
        ]);

        let exported = export_cell_value(rich.clone());
        match exported {
            current::CellValueSchema::RichText(spans) => {
                assert_eq!(spans.len(), 2);
                assert_eq!(spans[0].text, "Normal ");
                assert!(spans[0].link.is_none());
                assert_eq!(spans[1].text, "link");
                assert_eq!(spans[1].link, Some("https://example.com".to_string()));
            }
            _ => panic!("Expected RichText variant"),
        }

        // Round-trip test
        let exported_schema = export_cell_value(rich.clone());
        let imported = import_cell_value(exported_schema);
        assert_eq!(imported, rich);
    }

    #[test]
    fn test_import_rich_text_cell_value() {
        let schema = current::CellValueSchema::RichText(vec![current::TextSpanSchema {
            text: "Bold text".to_string(),
            bold: Some(true),
            link: None,
            italic: None,
            underline: None,
            strike_through: None,
            text_color: None,
            font_size: None,
        }]);

        let imported = import_cell_value(schema);
        match imported {
            CellValue::RichText(spans) => {
                assert_eq!(spans.len(), 1);
                assert_eq!(spans[0].text, "Bold text");
                assert_eq!(spans[0].bold, Some(true));
            }
            _ => panic!("Expected RichText variant"),
        }
    }
}
