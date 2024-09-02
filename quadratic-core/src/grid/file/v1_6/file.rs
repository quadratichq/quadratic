use std::collections::HashMap;

use anyhow::Result;

use super::schema::{self as current};
use crate::grid::file::v1_7::schema::{
    self as v1_7, BorderStyleTimestampSchema, CellBorderSchema, ColumnRepeatSchema,
};

// used to index for upgrade_borders
// enum CellSide {
//     Left = 0,
//     Top = 1,
//     Right = 2,
//     Bottom = 3,
// }

fn upgrade_borders(_borders: current::Borders) -> Result<v1_7::BordersSchema> {
    // let mut left: HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>> = HashMap::new();
    // let mut right: HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>> = HashMap::new();
    // let mut top: HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>> = HashMap::new();
    // let mut bottom: HashMap<i64, ColumnRepeatSchema<BorderStyleTimestampSchema>> = HashMap::new();

    // for (col_id, sheet_borders) in borders {
    //     let col: i64 = col_id
    //         .parse::<i64>()
    //         .expect("Failed to parse col_id as i64");
    //     for (row, row_borders) in sheet_borders {
    //         if let Some(left_old) = row_borders[0].as_ref() {
    //             left.entry(col)
    //                 .or_insert_with(|| ColumnRepeatSchema {
    //                     value: BorderStyleTimestampSchema::default(),
    //                     len: 0,
    //                 })
    //                 .value
    //                 .push((row, left_old.clone()));
    //         }
    //         if let Some(right_old) = row_borders[2].as_ref() {
    //             right
    //                 .entry(col)
    //                 .or_insert_with(|| ColumnRepeatSchema {
    //                     value: BorderStyleTimestampSchema::default(),
    //                     len: 0,
    //                 })
    //                 .value
    //                 .push((row, right_old.clone()));
    //         }
    //         if let Some(top_old) = row_borders[1].as_ref() {
    //             top.entry(row)
    //                 .or_insert_with(|| ColumnRepeatSchema {
    //                     value: BorderStyleTimestampSchema::default(),
    //                     len: 0,
    //                 })
    //                 .value
    //                 .push((col, top_old.clone()));
    //         }
    //         if let Some(bottom_old) = row_borders[3].as_ref() {
    //             bottom
    //                 .entry(row)
    //                 .or_insert_with(|| ColumnRepeatSchema {
    //                     value: BorderStyleTimestampSchema::default(),
    //                     len: 0,
    //                 })
    //                 .value
    //                 .push((col, bottom_old.clone()));
    //         }
    //     }
    // }

    let borders = v1_7::BordersSchema {
        all: v1_7::BorderStyleCellSchema::default(),
        columns: HashMap::new(),
        rows: HashMap::new(),

        left: HashMap::new(),
        right: HashMap::new(),
        top: HashMap::new(),
        bottom: HashMap::new(),
    };
    Ok(borders)
}

pub fn upgrade_sheet(sheet: &current::Sheet) -> Result<v1_7::SheetSchema> {
    Ok(v1_7::SheetSchema {
        id: sheet.id.clone(),
        name: sheet.name.clone(),
        color: sheet.color.clone(),
        order: sheet.order.clone(),
        offsets: sheet.offsets.clone(),
        columns: sheet.columns.clone(),
        code_runs: sheet.code_runs.clone(),
        formats_all: sheet.formats_all.clone(),
        formats_columns: sheet.formats_columns.clone(),
        formats_rows: sheet.formats_rows.clone(),
        rows_resize: sheet.rows_resize.clone(),
        validations: sheet.validations.clone(),
        borders: upgrade_borders(sheet.borders.clone())?,
    })
}

pub fn upgrade(grid: current::GridSchema) -> Result<v1_7::GridSchema> {
    let new_grid = v1_7::GridSchema {
        version: Some("1.7".to_string()),
        sheets: grid
            .sheets
            .iter()
            .map(|sheet| upgrade_sheet(sheet))
            .collect::<Result<_, _>>()?,
    };
    Ok(new_grid)
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::grid::file::{export, import};

    const V1_5_FILE: &[u8] =
        include_bytes!("../../../../../quadratic-rust-shared/data/grid/v1_5_simple.grid");

    const V1_6_BORDERS_FILE: &[u8] = include_bytes!("../../../../test-files/borders_1_6.grid");

    #[test]
    #[parallel]
    fn import_and_export_a_v1_5_file() {
        let imported = import(V1_5_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }

    #[test]
    #[parallel]
    fn import_and_export_a_v1_6_borders_file() {
        let imported = import(V1_6_BORDERS_FILE.to_vec()).unwrap();
        let exported = export(imported.clone()).unwrap();
        let imported_copy = import(exported).unwrap();
        assert_eq!(imported_copy, imported);
    }
}
