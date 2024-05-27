use self::selection::Selection;

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns a summary of the formatting in a region as a
    /// [`CellFormatSummary`].
    #[wasm_bindgen(js_name = "getCellFormatSummary")]
    pub fn js_cell_format_summary(&self, sheet_id: String, pos: &Pos) -> Result<JsValue, JsValue> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Result::Err("Sheet not found".into());
        };
        let output: CellFormatSummary = sheet.get_cell_format_summary(*pos);
        Ok(serde_wasm_bindgen::to_value(&output)?)
    }

    /// Sets cell align formatting given as an optional [`CellAlign`].
    #[wasm_bindgen(js_name = "setCellAlign")]
    pub fn js_set_cell_align(
        &mut self,
        selection: String,
        align: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let align = CellAlign::from_str(&align).map_err(|_| "Invalid align")?;
        self.set_cell_align_selection(selection, align, cursor)
    }

    /// Sets cell wrap formatting given as an optional [`CellWrap`].
    #[wasm_bindgen(js_name = "setCellWrap")]
    pub fn js_set_cell_wrap(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        wrap: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        if let Ok(value) = serde_wasm_bindgen::from_value(wrap) {
            self.set_cell_wrap(rect.to_sheet_rect(sheet_id), value, cursor);
        }
        Ok(())
    }

    /// Sets cells numeric_format to normal
    #[wasm_bindgen(js_name = "removeCellNumericFormat")]
    pub fn js_remove_numeric_format(
        &mut self,
        _selection: String,
        _cursor: Option<String>,
    ) -> Result<(), JsValue> {
        todo!();
        // let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        // self.remove_number_formatting(selection, cursor);
        // Ok(())
    }

    /// Sets cells numeric_format to currency
    #[wasm_bindgen(js_name = "setCellCurrency")]
    pub fn js_set_cell_currency(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        symbol: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        self.set_currency(&rect.to_sheet_rect(sheet_id), Some(symbol), cursor);
        Ok(())
    }

    /// Sets cells numeric_format to percentage
    #[wasm_bindgen(js_name = "setCellPercentage")]
    pub fn js_set_cell_percentage(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        let currency = NumericFormat {
            kind: NumericFormatKind::Percentage,
            symbol: None,
        };
        self.set_cell_numeric_format(rect.to_sheet_rect(sheet_id), Some(currency), cursor);
        Ok(())
    }

    /// Sets cells numeric_format to scientific notation
    #[wasm_bindgen(js_name = "setCellExponential")]
    pub fn js_set_cell_exponential(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        let exponential = NumericFormat {
            kind: NumericFormatKind::Exponential,
            symbol: None,
        };
        self.set_cell_numeric_format(rect.to_sheet_rect(sheet_id), Some(exponential), cursor);
        Ok(())
    }

    /// Sets cells numeric_commas
    #[wasm_bindgen(js_name = "toggleCommas")]
    pub fn js_toggle_commas(
        &mut self,
        sheet_id: String,
        source: Pos,
        rect: Rect,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        self.toggle_commas(
            source.to_sheet_pos(sheet_id),
            rect.to_sheet_rect(sheet_id),
            cursor,
        );
        Ok(())
    }

    /// Sets cell bold formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setCellBold")]
    pub fn js_set_cell_bold(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        bold: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        self.set_cell_bold(rect.to_sheet_rect(sheet_id), bold, cursor);
        Ok(())
    }
    /// Sets cell italic formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setCellItalic")]
    pub fn js_set_cell_italic(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        italic: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        self.set_cell_italic(rect.to_sheet_rect(sheet_id), italic, cursor);
        Ok(())
    }

    /// Sets cell text color given as an optional [`String`].
    #[wasm_bindgen(js_name = "setCellTextColor")]
    pub fn js_set_cell_text_color(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        text_color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        self.set_cell_text_color(rect.to_sheet_rect(sheet_id), text_color, cursor);
        Ok(())
    }

    /// Sets cell fill color given as an optional [`String`].
    #[wasm_bindgen(js_name = "setCellFillColor")]
    pub fn js_set_cell_fill_color(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        fill_color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        self.set_cell_fill_color(rect.to_sheet_rect(sheet_id), fill_color, cursor);
        Ok(())
    }

    /// Sets cell render size (used for Html-style cells).
    #[wasm_bindgen(js_name = "setCellRenderSize")]
    pub fn js_set_cell_render_size(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        w: Option<String>,
        h: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        let value = if let (Some(w), Some(h)) = (w, h) {
            Some(RenderSize {
                w: w.to_owned(),
                h: h.to_owned(),
            })
        } else {
            None
        };
        self.set_cell_render_size(rect.to_sheet_rect(sheet_id), value, cursor);
        Ok(())
    }

    /// Changes cell numeric decimals.
    #[wasm_bindgen(js_name = "changeDecimalPlaces")]
    pub fn js_change_decimal_places(
        &mut self,
        sheet_id: String,
        source: Pos,
        rect: &Rect,
        delta: isize,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        self.change_decimal_places(
            source.to_sheet_pos(sheet_id),
            rect.to_sheet_rect(sheet_id),
            delta,
            cursor,
        );
        Ok(())
    }

    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "clearFormatting")]
    pub fn js_clear_formatting(
        &mut self,
        sheet_id: String,
        rect: Rect,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Result::Err("Invalid sheet id".into());
        };
        self.clear_formatting(rect.to_sheet_rect(sheet_id), cursor);
        Ok(())
    }
}
