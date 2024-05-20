use crate::CellValue;
use crate::file::v1_6::schema::{self as current},

pub fn export_cell_value(cell_value: &CellValue) -> current::CellValue {
    match cell_value {
        CellValue::Text(text) => current::CellValue::Text(text.to_owned()),
        CellValue::Number(number) => {
            current::CellValue::Number(number.to_f32().unwrap_or_default())
        }
        CellValue::Html(html) => current::CellValue::Html(html.to_owned()),
        CellValue::Code(cell_code) => current::CellValue::Code(current::CodeCell {
            code: cell_code.code.to_owned(),
            language: match cell_code.language {
                CodeCellLanguage::Python => current::CodeCellLanguage::Python,
                CodeCellLanguage::Formula => current::CodeCellLanguage::Formula,
            },
        }),
        CellValue::Logical(logical) => current::CellValue::Logical(*logical),
        CellValue::Instant(instant) => current::CellValue::Instant(instant.to_string()),
        CellValue::Duration(duration) => current::CellValue::Duration(duration.to_string()),
        CellValue::Error(error) => {
            current::CellValue::Error(current::RunError::from_grid_run_error(error))
        }
        CellValue::Blank => current::CellValue::Blank,
    }
}

pub fn big_decimal_to_cell_value(number: BigDecimal) -> CellValue {
    let (bigint, exponent) = number.as_bigint_and_exponent();
    if exponent >= 0 {
        CellValue::NumberI64(bigint.to_i64().unwrap_or_default())
    } else {
        CellValue::NumberF64((bigint.to_i64().unwrap_or_default(), exponent as u32))
    }
}

pub fn import_cell_value(value: &current::CellValue) -> CellValue {
    match value {
        current::CellValue::Text(text) => CellValue::Text(text.to_owned()),
        current::CellValue::Number(number) => {
            CellValue::Number(BigDecimal::from_f32(*number).unwrap_or_default())
        }
        current::CellValue::Html(html) => CellValue::Html(html.to_owned()),
        current::CellValue::Code(code_cell) => CellValue::Code(CodeCellValue {
            code: code_cell.code.to_owned(),
            language: match code_cell.language {
                current::CodeCellLanguage::Python => CodeCellLanguage::Python,
                current::CodeCellLanguage::Formula => CodeCellLanguage::Formula,
            },
        }),
        current::CellValue::Logical(logical) => CellValue::Logical(*logical),
        current::CellValue::Instant(_instant) => {
            todo!()
        }
        current::CellValue::Duration(_duration) => {
            todo!()
        }
        current::CellValue::Error(error) => CellValue::Error(Box::new((*error).clone().into())),
        current::CellValue::Blank => CellValue::Blank,
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::file::v1_5::schema::GridSchema;
    use anyhow::{anyhow, Result};

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
