use std::collections::HashMap;

use crate::grid::file::v1_5::schema as v1_5;
use crate::grid::file::v1_6::schema::{self as v1_6};

use anyhow::Result;

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
        println!("{}", exported);
        // assert_eq!(V1_4_FILE, exported);
    }
}

fn upgrade_column(x: &i64, column: &v1_5::Column) -> (i64, v1_6::Column) {
    (
        *x,
        v1_6::Column {
            values: column.values.clone(),
            align: column.align.clone(),
            vertical_align: HashMap::new(),
            wrap: column.wrap.clone(),
            numeric_format: column.numeric_format.clone(),
            numeric_decimals: column.numeric_decimals.clone(),
            numeric_commas: column.numeric_commas.clone(),
            bold: column.bold.clone(),
            italic: column.italic.clone(),
            text_color: column.text_color.clone(),
            fill_color: column.fill_color.clone(),
            render_size: column.render_size.clone(),
        },
    )
}

fn upgrade_columns(sheet: &v1_5::Sheet) -> Vec<(i64, v1_6::Column)> {
    sheet
        .columns
        .iter()
        .map(|(x, column)| upgrade_column(x, column))
        .collect()
}

fn upgrade_sheet(sheet: &v1_5::Sheet) -> v1_6::Sheet {
    v1_6::Sheet {
        id: sheet.id.clone(),
        name: sheet.name.clone(),
        color: sheet.color.clone(),
        order: sheet.order.clone(),
        offsets: sheet.offsets.clone(),
        columns: upgrade_columns(sheet),
        borders: sheet.borders.clone(),
        code_runs: sheet.code_runs.clone(),
    }
}

pub(crate) fn upgrade(schema: v1_5::GridSchema) -> Result<v1_6::GridSchema> {
    let schema = v1_6::GridSchema {
        version: Some("1.6".into()),
        sheets: schema.sheets.iter().map(upgrade_sheet).collect(),
    };
    Ok(schema)
}
