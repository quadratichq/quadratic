use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns a summary of the formatting in a region as a
    /// [`FormattingSummary`].
    #[wasm_bindgen(js_name = "getFormattingSummary")]
    pub fn js_formatting_summary(
        &self,
        sheet_id: String,
        region: &Rect,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output: FormattingSummary = self.sheet(sheet_id).get_formatting_summary(*region);
        Ok(serde_wasm_bindgen::to_value(&output)?)
    }

    /// Returns a summary of the formatting in a region as a
    /// [`CellFormatSummary`].
    #[wasm_bindgen(js_name = "getCellFormatSummary")]
    pub fn js_cell_format_summary(&self, sheet_id: String, pos: &Pos) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output: CellFormatSummary = self.sheet(sheet_id).get_cell_format_summary(*pos);
        Ok(serde_wasm_bindgen::to_value(&output)?)
    }

    /// Sets cell align formatting given as a [`CellAlign`].
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellAlign")]
    pub fn js_set_cell_align(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        align: JsValue,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let value: CellAlign = serde_wasm_bindgen::from_value(align).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_align(sheet_id, *rect, value, cursor),
        )?)
    }

    /// Sets cell wrap formatting given as a [`CellWrap`].
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellWrap")]
    pub fn js_set_cell_wrap(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        wrap: JsValue,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let value: CellWrap = serde_wasm_bindgen::from_value(wrap).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_wrap(sheet_id, *rect, value, cursor),
        )?)
    }

    /// Sets cell numeric formatting given as a [`NumericFormat`].
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellNumericFormat")]
    pub fn js_set_cell_numeric_format(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        numeric_format: JsValue,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let value: NumericFormat = serde_wasm_bindgen::from_value(numeric_format).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_numeric_format(sheet_id, *rect, value, cursor),
        )?)
    }

    /// Sets cell bold formatting given as a [`bool`].
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellBold")]
    pub fn js_set_cell_bold(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        bold: JsValue,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let value: bool = serde_wasm_bindgen::from_value(bold).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_bold(sheet_id, *rect, value, cursor),
        )?)
    }
    /// Sets cell italic formatting given as a [`bool`].
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellItalic")]
    pub fn js_set_cell_italic(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        italic: JsValue,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let value: bool = serde_wasm_bindgen::from_value(italic).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_italic(sheet_id, *rect, value, cursor),
        )?)
    }

    /// Sets cell text color given as a [`String`].
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellTextColor")]
    pub fn js_set_cell_text_color(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        text_color: JsValue,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let value: String = serde_wasm_bindgen::from_value(text_color).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_text_color(sheet_id, *rect, value, cursor),
        )?)
    }
    /// Sets cell fill color given as a [`String`].
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellFillColor")]
    pub fn js_set_cell_fill_color(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        fill_color: JsValue,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let value: String = serde_wasm_bindgen::from_value(fill_color).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_fill_color(sheet_id, *rect, value, cursor),
        )?)
    }
}
