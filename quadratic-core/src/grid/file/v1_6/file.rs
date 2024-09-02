use anyhow::Result;

use super::schema::{self as current};
use crate::{
    border_style::{BorderStyle, CellBorderLine},
    color::Rgba,
    grid::{
        file::{
            serialize::borders::export_borders,
            v1_7::schema::{self as v1_7},
        },
        sheet::borders::Borders,
    },
};

// index for old borders enum
// enum CellSide {
//     Left = 0,
//     Top = 1,
//     Right = 2,
//     Bottom = 3,
// }

fn upgrade_borders(borders: current::Borders) -> Result<v1_7::BordersSchema> {
    fn convert_border_style(border_style: &current::CellBorder) -> Result<BorderStyle> {
        let color = Rgba::color_from_str(&border_style.color)?;
        let line = serde_json::from_str::<CellBorderLine>(&border_style.line)?;
        Ok(BorderStyle { color, line })
    }
    let mut borders_new = Borders::default();

    for (col_id, sheet_borders) in borders {
        let col: i64 = col_id
            .parse::<i64>()
            .expect("Failed to parse col_id as i64");
        for (row, row_borders) in sheet_borders {
            if let Some(left_old) = row_borders[0].as_ref() {
                if let Ok(style) = convert_border_style(left_old) {
                    borders_new.set(col, row, None, None, Some(style), None);
                }
            }
            if let Some(right_old) = row_borders[2].as_ref() {
                if let Ok(style) = convert_border_style(right_old) {
                    borders_new.set(col, row, None, None, None, Some(style));
                }
            }
            if let Some(top_old) = row_borders[1].as_ref() {
                if let Ok(style) = convert_border_style(top_old) {
                    borders_new.set(col, row, Some(style), None, None, None);
                }
            }
            if let Some(bottom_old) = row_borders[3].as_ref() {
                if let Ok(style) = convert_border_style(bottom_old) {
                    borders_new.set(col, row, None, Some(style), None, None);
                }
            }
        }
    }

    let borders = export_borders(&borders_new);
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
