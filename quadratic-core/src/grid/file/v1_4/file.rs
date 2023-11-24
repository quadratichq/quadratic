use crate::grid::file::v1_4::schema as v1_4;
use crate::grid::file::v1_5::schema as v1_5;
use anyhow::Result;

// todo: use Result instead of panicking

fn upgrade_column(sheet: &v1_4::Sheet, x: &i64, column: &v1_4::Column) -> (i64, v1_5::Column) {
    (
        x.clone(),
        v1_5::Column {
            values: column.values.clone(),
            spills: column.spills.clone(),
            align: column.align.clone(),
            wrap: column.wrap.clone(),
            numeric_format: column.numeric_format.clone(),
            numeric_decimals: column.numeric_decimals.clone(),
            numeric_commas: column.numeric_commas.clone(),
            bold: column.bold.clone(),
            italic: column.italic.clone(),
            text_color: column.text_color.clone(),
            fill_color: column.fill_color.clone(),
        },
    )
}

fn upgrade_columns(sheet: &v1_4::Sheet) -> Vec<(i64, v1_5::Column)> {
    sheet
        .columns
        .iter()
        .map(|(x, column)| upgrade_column(sheet, x, column))
        .collect()
}

fn cell_ref_to_sheet_pos(sheet: &v1_4::Sheet, cell_ref: &v1_4::CellRef) -> v1_5::SheetPos {
    let x = sheet
        .columns
        .iter()
        .find(|column| column.1.id == cell_ref.column)
        .unwrap()
        .0;
    let y = sheet
        .rows
        .iter()
        .find(|row| row.1 == cell_ref.row)
        .unwrap()
        .0;
    v1_5::SheetPos {
        x,
        y,
        sheet_id: v1_5::Id::from(cell_ref.sheet.id.clone()),
    }
}

fn upgrade_code_cells(sheet: &v1_4::Sheet) -> Vec<(v1_5::SheetPos, v1_5::CodeCellValue)> {
    let code_cells = sheet.code_cells;
    sheet
        .code_cells
        .into_iter()
        .map(|(cell_ref, code_cell_value)| {
            let sheet_pos = cell_ref_to_sheet_pos(sheet, &cell_ref);
            (sheet_pos, code_cell_value)
        })
        .collect()
}

fn upgrade_sheet(sheet: &v1_4::Sheet) -> v1_5::Sheet {
    let columns = upgrade_columns(sheet);
    v1_5::Sheet {
        id: v1_5::Id::from(sheet.id.id.clone()),
        name: sheet.name.clone(),
        color: sheet.color.clone(),
        order: sheet.order.clone(),
        offsets: sheet.offsets.clone(),
        columns,
        borders: sheet.borders.clone(),
        code_cells: upgrade_code_cells(sheet),
    }
}

pub(crate) fn upgrade(schema: v1_4::GridSchema) -> Result<v1_5::GridSchema> {
    let schema = v1_5::GridSchema {
        version: Some("1.5".into()),
        sheets: schema.sheets.iter().map(upgrade_sheet).collect(),
    };
    Ok(schema)
}

#[cfg(test)]
mod tests {
    use crate::grid::file::v1_4::schema::GridSchema;
    use anyhow::{anyhow, Result};

    const V1_4_FILE: &str = include_str!("../../../../examples/v1_4_simple.grid");

    fn import(file_contents: &str) -> Result<GridSchema> {
        serde_json::from_str::<GridSchema>(file_contents)
            .map_err(|e| anyhow!("Could not import file: {:?}", e))
    }

    fn export(grid_schema: &GridSchema) -> Result<String> {
        serde_json::to_string(grid_schema).map_err(|e| anyhow!("Could not export file: {:?}", e))
    }

    #[test]
    fn import_and_export_a_v1_4_file() {
        let imported = import(V1_4_FILE).unwrap();
        let exported = export(&imported).unwrap();
        println!("{}", exported);
        // assert_eq!(V1_4_FILE, exported);
    }
}
