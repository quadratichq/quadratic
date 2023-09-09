use std::collections::HashMap;

use itertools::Itertools;

pub use super::current::*; // when creating new version, replace `current` with new module

use super::v1_4;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Grid {
    pub sheets: Vec<Sheet>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Sheet {
    pub id: SheetId,
    pub name: String,
    pub color: Option<String>,
    pub order: String,

    pub column_widths: Vec<(i64, f32)>,
    pub row_heights: Vec<(i64, f32)>,

    pub columns: Vec<(i64, Column)>,
    pub rows: Vec<(i64, RowId)>,
    pub borders: SheetBorders,
    pub code_cells: Vec<(CellRef, CodeCellValue)>,
}

impl v1_4::GridFileV1_4 {
    pub fn into_v1_5(self) -> Result<Grid, &'static str> {
        let ret = Grid {
            sheets: self
                .sheets
                .into_iter()
                .map(|sheet| {
                    sheet.into_v1_5()
                    // TODO: validate that sheet name is unique.
                    //       sheet ID is new so it is definitely unique.
                })
                .try_collect()?,
        };

        Ok(ret)
    }
}

struct SheetBuilder {
    sheet_id: SheetId,
    columns: HashMap<i64, Column>,
    column_ids: HashMap<i64, ColumnId>,
    row_ids: HashMap<i64, RowId>,
}
impl SheetBuilder {
    fn column_id(&mut self, x: i64) -> ColumnId {
        *self.column_ids.entry(x).or_insert_with(ColumnId::new)
    }
    fn row_id(&mut self, x: i64) -> RowId {
        *self.row_ids.entry(x).or_insert_with(RowId::new)
    }
    fn column(&mut self, x: i64) -> &mut Column {
        let id = self.column_id(x);
        self.columns.entry(x).or_insert_with(|| Column::with_id(id))
    }
    fn cell_ref(&mut self, pos: Pos) -> CellRef {
        CellRef {
            sheet: self.sheet_id,
            column: self.column_id(pos.x),
            row: self.row_id(pos.y),
        }
    }
}

impl v1_4::JsSheet {
    pub fn into_v1_5(self) -> Result<Sheet, &'static str> {
        let sheet_id = SheetId::new();

        let column_widths = self
            .columns
            .iter()
            .filter_map(|column| Some((column.id, column.size? as f32)))
            .collect();
        let row_heights = self
            .rows
            .iter()
            .filter_map(|row| Some((row.id, row.size? as f32)))
            .collect();

        let mut code_cells = vec![];

        let mut sheet = SheetBuilder {
            sheet_id,
            columns: HashMap::new(),
            column_ids: HashMap::new(),
            row_ids: HashMap::new(),
        };

        // Save cell data
        for js_cell in &self.cells {
            let js_cell_pos = Pos {
                x: js_cell.x,
                y: js_cell.y,
            };
            let js_cell_ref = sheet.cell_ref(js_cell_pos);
            if let Some(code_cell_value) = js_cell.to_code_cell_value(|pos| sheet.cell_ref(pos)) {
                if let Some(output) = code_cell_value
                    .output
                    .as_ref()
                    .and_then(CodeCellRunOutput::output_value)
                {
                    let source = js_cell_ref;
                    match output {
                        Value::Single(_) => {
                            let x = js_cell.x;
                            let y = js_cell.y;
                            sheet.column(x).spills.set(y, Some(source));
                        }
                        Value::Array(array) => {
                            for dy in 0..array.height() {
                                for dx in 0..array.width() {
                                    let x = js_cell.x + dx as i64;
                                    let y = js_cell.y + dy as i64;
                                    sheet.column(x).spills.set(y, Some(source));
                                }
                            }
                        }
                    }
                }
                code_cells.push((js_cell_ref, code_cell_value));
            } else if let Some(cell_value) = js_cell.to_cell_value() {
                let column = sheet.column(js_cell.x);
                column.values.set(js_cell.y, Some(cell_value));
            }
        }

        for js_format in &self.formats {
            let column = sheet.column(js_format.x);

            column.align.set(js_format.y, js_format.alignment);
            column.wrap.set(js_format.y, js_format.wrapping);

            if let Some(text_format) = js_format.text_format.clone() {
                column.numeric_format.set(
                    js_format.y,
                    Some(NumericFormat {
                        kind: text_format.kind,
                        symbol: text_format.symbol,
                    }),
                );

                if let Some(decimals) = text_format.decimal_places {
                    column
                        .numeric_decimals
                        .set(js_format.y, Some(decimals as i16));
                }
            }

            column.bold.set(js_format.y, js_format.bold);
            column.italic.set(js_format.y, js_format.italic);

            column
                .text_color
                .set(js_format.y, js_format.text_color.clone());
            column
                .fill_color
                .set(js_format.y, js_format.fill_color.clone());
        }

        Ok(Sheet {
            id: sheet_id,
            name: self.name,
            color: self.color,
            order: self.order,
            column_widths,
            row_heights,
            columns: sheet.columns.into_iter().collect(),
            rows: sheet.row_ids.into_iter().collect(),
            borders: SheetBorders::new(), // TODO: import borders
            code_cells,
        })
    }
}
