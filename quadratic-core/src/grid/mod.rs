use std::fmt;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

mod block;
mod borders;
mod bounds;
mod code;
mod column;
mod formatting;
mod ids;
mod js_structs;
mod legacy;
mod response;
mod sheet;

use block::{Block, BlockContent, CellValueBlockContent, SameValue};
use borders::CellBorder;
pub use bounds::GridBounds;
pub use code::*;
use column::{Column, ColumnData};
use formatting::{CellAlign, CellWrap, NumericFormat};
pub use ids::*;
use js_structs::*;
use sheet::Sheet;

use crate::{CellValue, Pos, Rect, Value};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[wasm_bindgen]
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
    pub fn from_legacy(file: &legacy::GridFile) -> Result<Self> {
        use legacy::*;

        let GridFile::V1_3(file) = file;
        let mut ret = Grid::new();
        ret.sheets = vec![];
        for js_sheet in &file.sheets {
            let sheet_id = ret.add_sheet();
            let sheet_index = ret.sheet_id_to_index(&sheet_id).unwrap();
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
                    if let Some(output) = &cell_code.output {
                        if let Ok(result) = &output.result {
                            let source = code_cell_ref;
                            match &result.output_value {
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

        Ok(ret)
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

    pub fn sheet_from_id(&self, sheet_id: &SheetId) -> &Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &self.sheets[sheet_index]
    }
    pub fn sheet_mut_from_id(&mut self, sheet_id: &SheetId) -> &mut Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &mut self.sheets[sheet_index]
    }

    fn set_same_values<T: fmt::Debug + Clone + PartialEq>(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
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

    fn delete_cell_columns<T: fmt::Debug + Clone + PartialEq>(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        pick_column_data: fn(&mut Column) -> &mut ColumnData<SameValue<T>>,
    ) {
        let sheet = self.sheet_mut_from_id(sheet_id);
        for x in region.x_range() {
            let column = sheet.get_or_create_column(x).1;
            pick_column_data(column).remove_range(region.y_range());
        }
    }
}

#[wasm_bindgen]
impl Grid {
    #[wasm_bindgen(js_name = "newFromFile")]
    pub fn js_new_from_file(file: JsValue) -> Result<Grid, JsValue> {
        let file = serde_wasm_bindgen::from_value(file)?;
        Grid::from_legacy(&file).map_err(|e| JsError::new(&e.to_string()).into())
    }

    #[wasm_bindgen(js_name = "exportToFile")]
    pub fn js_export_to_file(&self) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.to_legacy_file_format())?)
    }

    #[wasm_bindgen(constructor)]
    pub fn js_new() -> Self {
        Self::new()
    }

    #[wasm_bindgen(js_name = "addSheet")]
    pub fn js_add_sheet(&mut self) -> SheetId {
        self.add_sheet()
    }

    #[wasm_bindgen(js_name = "sheetIdToIndex")]
    pub fn sheet_id_to_index(&self, id: &SheetId) -> Option<usize> {
        self.sheet_ids.index_of(*id)
    }
    #[wasm_bindgen(js_name = "sheetIndexToId")]
    pub fn sheet_index_to_id(&self, index: usize) -> Option<SheetId> {
        self.sheet_ids.id_at(index)
    }

    #[wasm_bindgen(js_name = "populateWithRandomFloats")]
    pub fn populate_with_random_floats(&mut self, sheet_id: &SheetId, region: &Rect) {
        let sheet = self.sheet_mut_from_id(sheet_id);
        *sheet = Sheet::with_random_floats(sheet.id, sheet.name.clone(), *region);
    }

    #[wasm_bindgen(js_name = "recalculateBounds")]
    pub fn recalculate_bounds(&mut self, sheet_id: &SheetId) {
        self.sheet_mut_from_id(sheet_id).recalculate_bounds();
    }
    #[wasm_bindgen(js_name = "getGridBounds")]
    pub fn get_grid_bounds(
        &self,
        sheet_id: &SheetId,
        ignore_formatting: bool,
    ) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.sheet_from_id(sheet_id).bounds(ignore_formatting),
        )?)
    }

    #[wasm_bindgen(js_name = "getRenderCells")]
    pub fn get_render_cells(&self, sheet_id: &SheetId, &region: &Rect) -> Result<String, JsValue> {
        let output = self.sheet_from_id(sheet_id).get_render_cells(region);
        Ok(serde_json::to_string::<[JsRenderCell]>(&output).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "getRenderFills")]
    pub fn get_render_fills(&self, sheet_id: &SheetId, region: &Rect) -> Result<String, JsValue> {
        let output = self.sheet_from_id(sheet_id).get_render_fills(*region);
        Ok(serde_json::to_string::<[JsRenderFill]>(&output).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "getRenderCodeCells")]
    pub fn get_render_code_cells(
        &self,
        sheet_id: &SheetId,
        region: &Rect,
    ) -> Result<String, JsValue> {
        let output = self.sheet_from_id(sheet_id).get_render_code_cells(*region);
        Ok(serde_json::to_string::<[JsRenderCodeCell]>(&output).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "getRenderHorizontalBorders")]
    pub fn get_render_horizontal_borders(
        &self,
        sheet_id: &SheetId,
        region: &Rect,
    ) -> Result<String, JsValue> {
        let output = self
            .sheet_from_id(sheet_id)
            .get_render_horizontal_borders(*region);
        Ok(serde_json::to_string::<[JsRenderBorder]>(&output).map_err(|e| e.to_string())?)
    }
    #[wasm_bindgen(js_name = "getRenderVerticalBorders")]
    pub fn get_render_vertical_borders(
        &self,
        sheet_id: &SheetId,
        region: &Rect,
    ) -> Result<String, JsValue> {
        let output = self
            .sheet_from_id(sheet_id)
            .get_render_vertical_borders(*region);
        Ok(serde_json::to_string::<[JsRenderBorder]>(&output).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn set_cell_value(
        &mut self,
        sheet_id: &SheetId,
        pos: &Pos,
        cell_value: JsValue,
    ) -> Result<(), JsValue> {
        let cell_value: CellValue = serde_wasm_bindgen::from_value(cell_value)?;
        self.sheet_mut_from_id(sheet_id)
            .set_cell_value(*pos, cell_value);
        Ok(())
    }

    #[wasm_bindgen(js_name = "deleteCellValues")]
    pub fn delete_cell_values(&mut self, sheet_id: &SheetId, region: &Rect) -> Result<(), JsValue> {
        self.sheet_mut_from_id(sheet_id).delete_cell_values(*region);
        Ok(())
    }

    #[wasm_bindgen(js_name = "getCodeCellValue")]
    pub fn get_code_cell_value(
        &mut self,
        sheet_id: &SheetId,
        pos: &Pos,
    ) -> Result<JsValue, JsValue> {
        match self.sheet_from_id(sheet_id).get_code_cell(*pos) {
            Some(code_cell) => Ok(serde_wasm_bindgen::to_value(&code_cell)?),
            None => Ok(JsValue::UNDEFINED),
        }
    }

    #[wasm_bindgen(js_name = "setCodeCellValue")]
    pub fn set_code_cell_value(
        &mut self,
        sheet_id: &SheetId,
        pos: &Pos,
        code_cell_value: JsValue,
    ) -> Result<(), JsValue> {
        let code_cell_value: CodeCellValue = serde_wasm_bindgen::from_value(code_cell_value)?;
        self.sheet_mut_from_id(sheet_id)
            .set_code_cell_value(*pos, Some(code_cell_value));
        // TODO: return old code cell
        Ok(())
    }

    #[wasm_bindgen(js_name = "getFormattingSummary")]
    pub fn get_formatting_summary(
        &self,
        sheet_id: &SheetId,
        region: &Rect,
    ) -> Result<JsValue, JsValue> {
        let output = self.sheet_from_id(sheet_id).get_formatting_summary(*region);
        Ok(serde_wasm_bindgen::to_value(&output)?)
    }

    #[wasm_bindgen(js_name = "setCellAlign")]
    pub fn set_cell_align(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellAlign = serde_wasm_bindgen::from_value(value)?;
        self.set_same_values(sheet_id, region, |column| &mut column.align, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setCellWrap")]
    pub fn set_cell_wrap(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellWrap = serde_wasm_bindgen::from_value(value)?;
        self.set_same_values(sheet_id, region, |column| &mut column.wrap, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setHorizontalCellBorder")]
    pub fn set_horizontal_cell_border(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellBorder = serde_wasm_bindgen::from_value(value)?;
        self.sheet_mut_from_id(sheet_id)
            .set_horizontal_border(*region, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setVerticalCellBorder")]
    pub fn set_vertical_cell_border(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellBorder = serde_wasm_bindgen::from_value(value)?;
        self.sheet_mut_from_id(sheet_id)
            .set_vertical_border(*region, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setCellNumericFormat")]
    pub fn set_cell_numeric_format(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: NumericFormat = serde_wasm_bindgen::from_value(value)?;
        self.set_same_values(sheet_id, region, |column| &mut column.numeric_format, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setCellBold")]
    pub fn set_cell_bold(&mut self, sheet_id: &SheetId, region: &Rect, value: bool) {
        self.set_same_values(sheet_id, region, |column| &mut column.bold, value);
    }
    #[wasm_bindgen(js_name = "setCellItalic")]
    pub fn set_cell_italic(&mut self, sheet_id: &SheetId, region: &Rect, value: bool) {
        self.set_same_values(sheet_id, region, |column| &mut column.italic, value);
    }
    #[wasm_bindgen(js_name = "setCellTextColor")]
    pub fn set_cell_text_color(&mut self, sheet_id: &SheetId, region: &Rect, value: String) {
        self.set_same_values(sheet_id, region, |column| &mut column.text_color, value);
    }
    #[wasm_bindgen(js_name = "setCellFillColor")]
    pub fn set_cell_fill_color(&mut self, sheet_id: &SheetId, region: &Rect, value: String) {
        self.set_same_values(sheet_id, region, |column| &mut column.fill_color, value);
    }
    #[wasm_bindgen(js_name = "clearFormatting")]
    pub fn clear_formatting(&mut self, sheet_id: &SheetId, region: &Rect) {
        self.delete_cell_columns(sheet_id, region, |column| &mut column.fill_color);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.align);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.bold);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.italic);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.numeric_format);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.text_color);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.wrap);
    }
}

#[cfg(test)]
mod tests;
