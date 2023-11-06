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

    /// Sets cell align formatting given as an optional [`CellAlign`].
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
        let value: Option<CellAlign> = serde_wasm_bindgen::from_value(align).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_align(sheet_id, *rect, value, cursor),
        )?)
    }

    /// Sets cell wrap formatting given as an optional [`CellWrap`].
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
        let value: Option<CellWrap> = serde_wasm_bindgen::from_value(wrap).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_wrap(sheet_id, *rect, value, cursor),
        )?)
    }

    /// Sets cells numeric_format to normal
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "removeCellNumericFormat")]
    pub fn js_remove_numeric_format(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.remove_number_formatting(sheet_id, rect, cursor),
        )?)
    }

    /// Sets cells numeric_format to currency
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellCurrency")]
    pub fn js_set_cell_currency(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        symbol: String,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(&self.set_currency(
            sheet,
            rect,
            Some(symbol),
            cursor,
        ))?)
    }

    /// Sets cells numeric_format to percentage
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellPercentage")]
    pub fn js_set_cell_percentage(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let currency = NumericFormat {
            kind: NumericFormatKind::Percentage,
            symbol: None,
        };
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_numeric_format(sheet_id, *rect, Some(currency), cursor),
        )?)
    }

    /// Sets cells numeric_format to scientific notation
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellExponential")]
    pub fn js_set_cell_exponential(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let exponential = NumericFormat {
            kind: NumericFormatKind::Exponential,
            symbol: None,
        };
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_numeric_format(sheet_id, *rect, Some(exponential), cursor),
        )?)
    }

    /// Sets cell bold formatting given as an optional [`bool`].
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
        let value: Option<bool> = serde_wasm_bindgen::from_value(bold).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_bold(sheet_id, *rect, value, cursor),
        )?)
    }
    /// Sets cell italic formatting given as an optional [`bool`].
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
        let value: Option<bool> = serde_wasm_bindgen::from_value(italic).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_italic(sheet_id, *rect, value, cursor),
        )?)
    }

    /// Sets cell text color given as an optional [`String`].
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
        let value: Option<String> = serde_wasm_bindgen::from_value(text_color).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_text_color(sheet_id, *rect, value, cursor),
        )?)
    }
    /// Sets cell fill color given as an optional [`String`].
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
        let value: Option<String> = serde_wasm_bindgen::from_value(fill_color).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_fill_color(sheet_id, *rect, value, cursor),
        )?)
    }

    /// Changes cell numeric decimals.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "changeDecimalPlaces")]
    pub fn js_change_decimal_places(
        &mut self,
        sheet_id: String,
        source: Pos,
        rect: &Rect,
        delta: isize,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(&self.change_decimal_places(
            sheet_id, source, *rect, delta, cursor,
        ))?)
    }

    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "clearFormatting")]
    pub fn js_clear_formatting(
        &mut self,
        sheet_id: String,
        rect: Rect,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.clear_formatting(sheet_id, rect, cursor),
        )?)
    }
}
