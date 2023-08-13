use super::*;
use crate::grid::js_types::*;

#[wasm_bindgen]
impl Grid {
    /// Imports a [`Grid`] from a file (that fits the schema defined in JS).
    #[wasm_bindgen(js_name = "newFromFile")]
    pub fn js_new_from_file(file: JsValue) -> Result<Grid, JsValue> {
        Ok(Grid::from_legacy(&serde_wasm_bindgen::from_value(file)?))
    }

    /// Exports a [`Grid`] to a file. Returns a `GridFile` (fits JS schema).
    #[wasm_bindgen(js_name = "exportToFile")]
    pub fn js_export_to_file(&self) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.to_legacy_file_format())?)
    }

    /// Constructs a new empty grid.
    #[wasm_bindgen(constructor)]
    pub fn js_new() -> Self {
        Self::new()
    }

    /// Adds an empty sheet to the grid.
    #[wasm_bindgen(js_name = "addSheet")]
    pub fn js_add_sheet(&mut self) -> SheetId {
        self.add_sheet()
    }

    /// Returns the ID of the sheet at the given index.
    #[wasm_bindgen(js_name = "sheetIdToIndex")]
    pub fn js_sheet_id_to_index(&self, id: &SheetId) -> Option<usize> {
        self.sheet_id_to_index(*id)
    }
    /// Returns the index of the sheet with the given ID.
    #[wasm_bindgen(js_name = "sheetIndexToId")]
    pub fn js_sheet_index_to_id(&self, index: usize) -> Option<SheetId> {
        self.sheet_index_to_id(index)
    }

    /// Populates a portion of a sheet with random float values.
    #[wasm_bindgen(js_name = "populateWithRandomFloats")]
    pub fn populate_with_random_floats(&mut self, sheet_id: &SheetId, region: &Rect) {
        let sheet = self.sheet_mut_from_id(*sheet_id);
        *sheet = Sheet::with_random_floats(sheet.id, sheet.name.clone(), *region);
    }

    /// Recalculates a sheet's bounds.
    #[wasm_bindgen(js_name = "recalculateBounds")]
    pub fn recalculate_bounds(&mut self, sheet_id: &SheetId) {
        self.sheet_mut_from_id(*sheet_id).recalculate_bounds();
    }
    /// Returns a sheet's bounds.
    #[wasm_bindgen(js_name = "getGridBounds")]
    pub fn get_grid_bounds(
        &self,
        sheet_id: &SheetId,
        ignore_formatting: bool,
    ) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.sheet_from_id(*sheet_id).bounds(ignore_formatting),
        )?)
    }

    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    ///
    /// Returns a string containing a JSON array of [`JsRenderCell`].
    #[wasm_bindgen(js_name = "getRenderCells")]
    pub fn get_render_cells(&self, sheet_id: &SheetId, &region: &Rect) -> Result<String, JsValue> {
        let output: Vec<JsRenderCell> = self.sheet_from_id(*sheet_id).get_render_cells(region);
        Ok(serde_json::to_string::<[JsRenderCell]>(&output).map_err(|e| e.to_string())?)
    }
    /// Returns data for rendering cell fill color as a string containing a JSON
    /// array of [`JsRenderFill`].
    #[wasm_bindgen(js_name = "getRenderFills")]
    pub fn get_render_fills(&self, sheet_id: &SheetId, region: &Rect) -> Result<String, JsValue> {
        let output = self.sheet_from_id(*sheet_id).get_render_fills(*region);
        Ok(serde_json::to_string::<[JsRenderFill]>(&output).map_err(|e| e.to_string())?)
    }
    /// Returns data for rendering code cells as a string containing a JSON array
    /// of [`JsRenderCodeCell`].
    #[wasm_bindgen(js_name = "getRenderCodeCells")]
    pub fn get_render_code_cells(&self, sheet_id: &SheetId) -> Result<String, JsValue> {
        let output = self.sheet_from_id(*sheet_id).get_all_render_code_cells();
        Ok(serde_json::to_string::<[JsRenderCodeCell]>(&output).map_err(|e| e.to_string())?)
    }
    /// Returns data for rendering horizontal borders as a string containing a
    /// JSON array of [`JsRenderBorder`].
    #[wasm_bindgen(js_name = "getRenderHorizontalBorders")]
    pub fn get_render_horizontal_borders(&self, sheet_id: &SheetId) -> Result<String, JsValue> {
        let output = self
            .sheet_from_id(*sheet_id)
            .get_render_horizontal_borders();
        Ok(serde_json::to_string::<[JsRenderBorder]>(&output).map_err(|e| e.to_string())?)
    }
    /// Returns data for rendering vertical borders as a string containing a
    /// JSON array of [`JsRenderBorder`].
    #[wasm_bindgen(js_name = "getRenderVerticalBorders")]
    pub fn get_render_vertical_borders(&self, sheet_id: &SheetId) -> Result<String, JsValue> {
        let output = self.sheet_from_id(*sheet_id).get_render_vertical_borders();
        Ok(serde_json::to_string::<[JsRenderBorder]>(&output).map_err(|e| e.to_string())?)
    }

    /// Sets a cell value given as a [`CellValue`].
    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn set_cell_value(
        &mut self,
        sheet_id: &SheetId,
        pos: &Pos,
        cell_value: JsValue,
    ) -> Result<(), JsValue> {
        let cell_value: CellValue = serde_wasm_bindgen::from_value(cell_value)?;
        self.sheet_mut_from_id(*sheet_id)
            .set_cell_value(*pos, cell_value);
        Ok(())
    }

    /// Deletes a region of cells.
    #[wasm_bindgen(js_name = "deleteCellValues")]
    pub fn delete_cell_values(&mut self, sheet_id: &SheetId, region: &Rect) -> Result<(), JsValue> {
        self.sheet_mut_from_id(*sheet_id)
            .delete_cell_values(*region);
        Ok(())
    }

    /// Returns a code cell as a [`CodeCellValue`].
    #[wasm_bindgen(js_name = "getCodeCellValue")]
    pub fn get_code_cell_value(
        &mut self,
        sheet_id: &SheetId,
        pos: &Pos,
    ) -> Result<JsValue, JsValue> {
        match self.sheet_from_id(*sheet_id).get_code_cell(*pos) {
            Some(code_cell) => Ok(serde_wasm_bindgen::to_value(&code_cell)?),
            None => Ok(JsValue::UNDEFINED),
        }
    }

    /// Sets a code cell value given as a [`CodeCellValue`].
    #[wasm_bindgen(js_name = "setCodeCellValue")]
    pub fn set_code_cell_value(
        &mut self,
        sheet_id: &SheetId,
        pos: &Pos,
        code_cell_value: JsValue,
    ) -> Result<(), JsValue> {
        let code_cell_value: CodeCellValue = serde_wasm_bindgen::from_value(code_cell_value)?;
        self.sheet_mut_from_id(*sheet_id)
            .set_code_cell_value(*pos, Some(code_cell_value));
        // TODO: return old code cell
        Ok(())
    }

    /// Returns a summary of the formatting in a region as a
    /// [`FormattingSummary`].
    #[wasm_bindgen(js_name = "getFormattingSummary")]
    pub fn get_formatting_summary(
        &self,
        sheet_id: &SheetId,
        region: &Rect,
    ) -> Result<JsValue, JsValue> {
        let output: FormattingSummary = self
            .sheet_from_id(*sheet_id)
            .get_formatting_summary(*region);
        Ok(serde_wasm_bindgen::to_value(&output)?)
    }

    /// Sets the text alignment as a [`CellAlign`] in a region.
    #[wasm_bindgen(js_name = "setCellAlign")]
    pub fn set_cell_align(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellAlign = serde_wasm_bindgen::from_value(value)?;
        self.set_same_values(*sheet_id, *region, |column| &mut column.align, value);
        Ok(())
    }
    /// Sets the text wrapping as a [`CellWrap`] in a region.
    #[wasm_bindgen(js_name = "setCellWrap")]
    pub fn set_cell_wrap(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellWrap = serde_wasm_bindgen::from_value(value)?;
        self.set_same_values(*sheet_id, *region, |column| &mut column.wrap, value);
        Ok(())
    }
    /// Sets the horizontal borders as a [`CellBorder`] in a region.
    #[wasm_bindgen(js_name = "setHorizontalCellBorder")]
    pub fn set_horizontal_cell_border(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellBorder = serde_wasm_bindgen::from_value(value)?;
        self.sheet_mut_from_id(*sheet_id)
            .set_horizontal_border(*region, value);
        Ok(())
    }
    /// Sets the vertical borders as a [`CellBorder`] in a region.
    #[wasm_bindgen(js_name = "setVerticalCellBorder")]
    pub fn set_vertical_cell_border(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellBorder = serde_wasm_bindgen::from_value(value)?;
        self.sheet_mut_from_id(*sheet_id)
            .set_vertical_border(*region, value);
        Ok(())
    }
    /// Sets the numeric format as a [`NumericFormat`] in a region.
    #[wasm_bindgen(js_name = "setCellNumericFormat")]
    pub fn set_cell_numeric_format(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: NumericFormat = serde_wasm_bindgen::from_value(value)?;
        self.set_same_values(
            *sheet_id,
            *region,
            |column| &mut column.numeric_format,
            value,
        );
        Ok(())
    }
    /// Sets whether cell text is bold in a region.
    #[wasm_bindgen(js_name = "setCellBold")]
    pub fn set_cell_bold(&mut self, sheet_id: &SheetId, region: &Rect, value: bool) {
        self.set_same_values(*sheet_id, *region, |column| &mut column.bold, value);
    }
    /// Sets whether cell text is italic in a region.
    #[wasm_bindgen(js_name = "setCellItalic")]
    pub fn set_cell_italic(&mut self, sheet_id: &SheetId, region: &Rect, value: bool) {
        self.set_same_values(*sheet_id, *region, |column| &mut column.italic, value);
    }
    /// Sets text color in a region.
    #[wasm_bindgen(js_name = "setCellTextColor")]
    pub fn set_cell_text_color(&mut self, sheet_id: &SheetId, region: &Rect, value: String) {
        self.set_same_values(*sheet_id, *region, |column| &mut column.text_color, value);
    }
    /// Sets fill color in a region.
    #[wasm_bindgen(js_name = "setCellFillColor")]
    pub fn set_cell_fill_color(&mut self, sheet_id: &SheetId, region: &Rect, value: String) {
        self.set_same_values(*sheet_id, *region, |column| &mut column.fill_color, value);
    }
    /// Clears all formatting in a region.
    #[wasm_bindgen(js_name = "clearFormatting")]
    pub fn clear_formatting(&mut self, sheet_id: &SheetId, region: &Rect) {
        self.delete_cell_columns(*sheet_id, *region, |column| &mut column.fill_color);
        self.delete_cell_columns(*sheet_id, *region, |column| &mut column.align);
        self.delete_cell_columns(*sheet_id, *region, |column| &mut column.bold);
        self.delete_cell_columns(*sheet_id, *region, |column| &mut column.italic);
        self.delete_cell_columns(*sheet_id, *region, |column| &mut column.numeric_format);
        self.delete_cell_columns(*sheet_id, *region, |column| &mut column.text_color);
        self.delete_cell_columns(*sheet_id, *region, |column| &mut column.wrap);
    }
}
