use std::fmt;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

mod block;
mod borders;
mod bounds;
mod code;
mod column;
mod formatting;
mod ids;
pub mod js_types;
mod legacy;
mod response;
mod sheet;

use block::{Block, BlockContent, CellValueBlockContent, SameValue};
pub use borders::{CellBorder, CellBorderStyle, CellBorders};
pub use bounds::GridBounds;
pub use code::*;
pub use column::{Column, ColumnData};
pub use formatting::{BoolSummary, CellAlign, CellWrap, NumericFormat, NumericFormatKind};
pub use ids::*;
pub use sheet::Sheet;

use crate::{CellValue, Pos, Rect, Value};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct Grid {
    sheet_ids: IdMap<SheetId, usize>,
    sheets: Vec<Sheet>,

    created: f64,
    filename: String,
    id: Uuid,
    modified: f64,
}
impl Default for Grid {
    fn default() -> Self {
        Self::new()
    }
}
impl Grid {
    pub fn new() -> Self {
        let mut ret = Grid {
            sheet_ids: IdMap::new(),
            sheets: vec![],

            created: 0.0, // TODO: creation time
            filename: "Untitled".to_string(),
            id: Uuid::new_v4(),
            modified: 0.0, // TODO: modification time
        };
        ret.add_sheet();
        ret
    }
    pub fn from_legacy(file: &legacy::GridFile) -> Self {
        use legacy::*;

        let GridFile::V1_3(file) = file;
        let mut ret = Grid::new();
        ret.sheets = vec![];
        for js_sheet in &file.sheets {
            let sheet_id = ret.add_sheet();
            let sheet_index = ret.sheet_id_to_index(sheet_id).unwrap();
            let sheet = &mut ret.sheets_mut()[sheet_index];

            // Load cell data
            for js_cell in &js_sheet.cells {
                let column = sheet.get_or_create_column(js_cell.x).0.id;

                if let Some(cell_code) = js_cell.to_cell_code(sheet) {
                    let row = sheet.get_or_create_row(js_cell.y).id;
                    let code_cell_ref = CellRef {
                        sheet: sheet.id,
                        column,
                        row,
                    };
                    if let Some(output) = cell_code
                        .output
                        .as_ref()
                        .and_then(CodeCellRunOutput::output_value)
                    {
                        let source = code_cell_ref;
                        match output {
                            Value::Single(_) => {
                                let x = js_cell.x;
                                let y = js_cell.y;
                                let column = sheet.get_or_create_column(x).1;
                                column.spills.set(y, Some(source));
                            }
                            Value::Array(array) => {
                                for dy in 0..array.height() {
                                    for dx in 0..array.width() {
                                        let x = js_cell.x + dx as i64;
                                        let y = js_cell.y + dy as i64;
                                        let column = sheet.get_or_create_column(x).1;
                                        column.spills.set(y, Some(source));
                                    }
                                }
                            }
                        }
                    }
                    sheet.set_code_cell_value(
                        Pos {
                            x: js_cell.x,
                            y: js_cell.y,
                        },
                        Some(cell_code),
                    );
                } else if let Some(cell_value) = js_cell.to_cell_value() {
                    let x = js_cell.x;
                    let y = js_cell.y;
                    sheet.set_cell_value(Pos { x, y }, cell_value);
                }
            }

            for js_format in &js_sheet.formats {
                let (_, column) = sheet.get_or_create_column(js_format.x);

                column.align.set(js_format.y, js_format.alignment);
                column.wrap.set(js_format.y, js_format.wrapping);

                column
                    .numeric_format
                    .set(js_format.y, js_format.text_format.clone());

                column.bold.set(js_format.y, js_format.bold);
                column.italic.set(js_format.y, js_format.italic);

                column
                    .text_color
                    .set(js_format.y, js_format.text_color.clone());
                column
                    .fill_color
                    .set(js_format.y, js_format.fill_color.clone());
            }

            sheet.recalculate_bounds();
        }

        ret
    }

    pub fn sheets(&self) -> &[Sheet] {
        &self.sheets
    }
    pub fn sheets_mut(&mut self) -> &mut [Sheet] {
        &mut self.sheets
    }
    pub fn add_sheet(&mut self) -> SheetId {
        let id = SheetId::new();
        let name = format!("Sheet {}", self.sheets.len() + 1);
        self.sheet_ids.add(id, self.sheets.len());
        self.sheets.push(Sheet::new(id, name));
        id
    }

    pub fn sheet_id_to_index(&self, id: SheetId) -> Option<usize> {
        self.sheet_ids.index_of(id)
    }
    pub fn sheet_index_to_id(&self, index: usize) -> Option<SheetId> {
        self.sheet_ids.id_at(index)
    }
    pub fn sheet_from_id(&self, sheet_id: SheetId) -> &Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &self.sheets[sheet_index]
    }
    pub fn sheet_mut_from_id(&mut self, sheet_id: SheetId) -> &mut Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &mut self.sheets[sheet_index]
    }

    pub fn set_same_values<T: fmt::Debug + Clone + PartialEq>(
        &mut self,
        sheet_id: SheetId,
        region: Rect,
        pick_column_data: fn(&mut Column) -> &mut ColumnData<SameValue<T>>,
        value: T,
    ) {
        let sheet = self.sheet_mut_from_id(sheet_id);
        for x in region.x_range() {
            let column = sheet.get_or_create_column(x).1;
            pick_column_data(column).set_range(region.y_range(), value.clone());
        }
    }

    pub fn to_legacy_file_format(&self) -> legacy::GridFileV1_3 {
        legacy::GridFileV1_3 {
            sheets: self
                .sheets
                .iter()
                .map(|sheet| sheet.export_to_legacy_file_format())
                .collect(),
            created: self.created,
            filename: self.filename.clone(),
            id: self.id.to_string(),
            modified: self.modified,
        }
    }

    pub fn delete_cell_columns<T: fmt::Debug + Clone + PartialEq>(
        &mut self,
        sheet_id: SheetId,
        region: Rect,
        pick_column_data: fn(&mut Column) -> &mut ColumnData<SameValue<T>>,
    ) {
        let sheet = self.sheet_mut_from_id(sheet_id);
        for x in region.x_range() {
            let column = sheet.get_or_create_column(x).1;
            pick_column_data(column).remove_range(region.y_range());
        }
    }
}

#[cfg(test)]
mod tests;
