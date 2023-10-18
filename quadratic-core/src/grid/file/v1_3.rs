use anyhow::{anyhow, Result};
use std::collections::HashMap;

use crate::grid::file::v1_3_schema::GridSchema;
use crate::grid::file::v1_5_new::{
    import as import_v1_5, Borders as BordersV1_5, CellRef as CellRefV1_5, Column as ColumnV1_5,
    ColumnValue as ColumnValueV1_5, GridSchema as GridSchemaV1_5, Id as IdV1_5, Sheet as SheetV1_5,
};

pub(crate) fn import(file_contents: &str) -> Result<GridSchema> {
    Ok(serde_json::from_str::<GridSchema>(&file_contents)
        .map_err(|e| anyhow!("Could not import file: {:?}", e))?)
}

pub(crate) fn export(grid_schema: &GridSchema) -> Result<String> {
    Ok(
        serde_json::to_string(grid_schema)
            .map_err(|e| anyhow!("Could not export file: {:?}", e))?,
    )
}

pub(crate) fn upgrade(schema: GridSchema) -> Result<GridSchemaV1_5> {
    let sheet = to_v1_5_sheet(schema).unwrap();

    let converted = GridSchemaV1_5 {
        version: "1.5".into(),
        sheets: vec![sheet],
        dependencies: vec![],
        // dependencies: v.sheets.into_iter().map(|s| s.cell_dependency).collect(),
    };

    // println!("{:?}", converted);
    Ok(converted)
}

struct SheetBuilder {
    sheet_id: IdV1_5,
    columns: HashMap<i64, ColumnV1_5>,
    column_ids: HashMap<i64, IdV1_5>,
    row_ids: HashMap<i64, IdV1_5>,
}
impl SheetBuilder {
    fn column_id(&mut self, x: i64) -> &mut IdV1_5 {
        self.column_ids.entry(x).or_insert_with(IdV1_5::new)
    }
    fn row_id(&mut self, x: i64) -> &mut IdV1_5 {
        self.row_ids.entry(x).or_insert_with(IdV1_5::new)
    }
    fn column(&mut self, x: i64) -> &mut ColumnV1_5 {
        let id = self.column_id(x).to_owned();
        self.columns
            .entry(x)
            .or_insert_with(|| ColumnV1_5::with_id(id))
    }
    fn cell_ref(&mut self, (x, y): (i64, i64)) -> CellRefV1_5 {
        CellRefV1_5 {
            sheet: self.sheet_id.id.to_owned(),
            column: self.column_id(x).id.to_owned(),
            row: self.row_id(y).id.to_owned(),
        }
    }
}

pub(crate) fn to_v1_5_sheet(v: GridSchema) -> Result<SheetV1_5> {
    let sheet_id = IdV1_5::new();
    let column_widths = v
        .columns
        .iter()
        .map(|column| (column.id, column.size))
        .collect();
    let row_heights = v.rows.iter().map(|row| (row.id, row.size)).collect();

    let mut code_cells = vec![];
    // let mut column_values = vec![];

    let mut sheet = SheetBuilder {
        sheet_id,
        columns: HashMap::new(),
        column_ids: HashMap::new(),
        row_ids: HashMap::new(),
    };

    // Save cell data
    for js_cell in &v.cells {
        let js_cell_pos = (js_cell.x, js_cell.y);
        let js_cell_ref = sheet.cell_ref(js_cell_pos);
        // column_values.push((js_cell.y, cell_value.to_string()));

        match js_cell.type_field.to_lowercase().as_str() {
            "text" => {
                let column = sheet.column(js_cell.x);
                // println!("{} {} {}", js_cell.x, js_cell.y, js_cell.value);
                column.values.push((
                    js_cell.y,
                    (
                        js_cell.y,
                        ColumnValueV1_5 {
                            type_field: "text".into(),
                            value: js_cell.value.to_owned(),
                        },
                    )
                        .into(),
                ));
            }
            _ => {}
        };
        // column_values.push((js_cell.y, values).into());
        // if let Some(code_cell_value) = js_cell.to_code_cell_value(|pos| sheet.cell_ref(pos)) {
        //     if let Some(output) = code_cell_value
        //         .output
        //         .as_ref()
        //         .and_then(CodeCellRunOutput::output_value)
        //     {
        //         let source = js_cell_ref;
        //         match output {
        //             Value::Single(_) => {
        //                 let x = js_cell.x;
        //                 let y = js_cell.y;
        //                 sheet.column(x).spills.set(y, Some(source));
        //             }
        //             Value::Array(array) => {
        //                 for dy in 0..array.height() {
        //                     for dx in 0..array.width() {
        //                         let x = js_cell.x + dx as i64;
        //                         let y = js_cell.y + dy as i64;
        //                         sheet.column(x).spills.set(y, Some(source));
        //                     }
        //                 }
        //             }
        //         }
        //     }
        //     code_cells.push((js_cell_ref, code_cell_value));
        // } else if let Some(cell_value) = js_cell.to_cell_value() {
        //     let column = sheet.column(js_cell.x);
        //     column.values.set(js_cell.y, Some(cell_value));
        // }
    }

    for js_format in v.formats {
        let column = sheet.column(js_format.x);
        let y = js_format.y.to_owned();
        js_format
            .alignment
            .map(|format| column.align.push((y, format.into())));
        js_format
            .wrapping
            .map(|format| column.wrap.push((y, format)));
        js_format
            .bold
            .map(|format| column.bold.push((y, format.into())));
        js_format
            .italic
            .map(|format| column.italic.push((y, format.into())));
        js_format
            .text_color
            .map(|format| column.text_color.push((y, format.into())));
        js_format
            .fill_color
            .map(|format| column.fill_color.push((y, format.into())));

        // if let Some(text_format) = js_format.text_format.clone() {
        //     column.numeric_format.set(
        //         js_format.y,
        //         Some(NumericFormat {
        //             kind: text_format.kind,
        //             symbol: text_format.symbol,
        //         }),
        //     );

        //     if let Some(decimals) = text_format.decimal_places {
        //         column
        //             .numeric_decimals
        //             .set(js_format.y, Some(decimals as i16));
        //     }
        // }
    }

    Ok(SheetV1_5 {
        id: IdV1_5::new(),
        name: "Sheet 1".into(),
        color: None,
        order: "a0".into(),
        offsets: (column_widths, row_heights),
        columns: sheet
            .columns
            .into_iter()
            .map(|(id, col)| {
                (
                    id.to_owned(),
                    ColumnV1_5 {
                        id: col.id,
                        values: col.values,
                        spills: col.spills,
                        align: col.align,
                        wrap: col.wrap,
                        numeric_format: col.numeric_format,
                        numeric_decimals: col.numeric_decimals,
                        bold: col.bold,
                        italic: col.italic,
                        text_color: col.text_color,
                        fill_color: col.fill_color,
                    },
                )
            })
            .collect(),
        rows: sheet
            .row_ids
            .into_iter()
            .map(|(id, row_id)| (id, IdV1_5 { id: row_id.id }))
            .collect(),
        borders: BordersV1_5 {
            horizontal: vec![],
            vertical: vec![],
        }, // TODO: import borders
        code_cells,
    })
}

#[cfg(test)]
mod tests {

    use crate::{controller::GridController, Pos, Rect};
    use std::io::Write;

    use super::*;

    const V1_5_FILE: &str = include_str!("../../../examples/v1_5.json");
    const V1_3_FILE: &str = include_str!("../../../examples/v1_3.json");

    #[tokio::test]
    async fn import_a_v1_3_grid() {
        let mut grid_controller = GridController::new();
        // let sheet_id = grid_controller.grid().sheets()[0].id;
        // let pos = Pos { x: 0, y: 0 };
        // let range = Rect::new_span(pos, Pos { x: 3, y: 10 });

        let imported = import(V1_3_FILE).unwrap();
        // println!("{:?}", imported);
        let upgraded = upgrade(imported).unwrap();
        let json = serde_json::to_string(&upgraded).unwrap();
        // println!("{}", json);

        let imported = import_v1_5(&json).unwrap();
        println!("{:?}", imported);
        // let path = "results_v1_3.json";
        // let mut output = std::fs::File::create(path).unwrap();
        // write!(output, "{}", ).unwrap();
    }
}
