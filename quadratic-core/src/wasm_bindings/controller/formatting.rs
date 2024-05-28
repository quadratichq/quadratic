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
        align: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let align = serde_wasm_bindgen::from_value(align).map_err(|_| "Invalid align")?;
        self.set_align_selection(selection, align, cursor)
    }

    /// Sets cell wrap formatting given as an optional [`CellWrap`].
    #[wasm_bindgen(js_name = "setCellWrap")]
    pub fn js_set_cell_wrap(
        &mut self,
        selection: String,
        wrap: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        if let Ok(wrap) = serde_wasm_bindgen::from_value(wrap) {
            self.set_cell_wrap_selection(selection, wrap, cursor)?;
        }
        Ok(())
    }

    /// Sets cells numeric_format to normal
    #[wasm_bindgen(js_name = "removeCellNumericFormat")]
    pub fn js_remove_numeric_format(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.remove_number_formatting_selection(selection, cursor)?;
        Ok(())
    }

    /// Sets cells numeric_format to currency
    #[wasm_bindgen(js_name = "setCellCurrency")]
    pub fn js_set_currency(
        &mut self,
        selection: String,
        symbol: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_numeric_format_selection(
            selection,
            NumericFormatKind::Currency,
            Some(symbol),
            cursor,
        )?;
        Ok(())
    }

    /// Sets cells numeric_format to percentage
    #[wasm_bindgen(js_name = "setCellPercentage")]
    pub fn js_set_percentage(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_numeric_format_selection(selection, NumericFormatKind::Percentage, None, cursor)?;
        Ok(())
    }

    /// Sets cells numeric_format to scientific notation
    #[wasm_bindgen(js_name = "setCellExponential")]
    pub fn js_set_exponential(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_numeric_format_selection(selection, NumericFormatKind::Exponential, None, cursor)?;
        Ok(())
    }

    /// Sets cells numeric_commas
    #[wasm_bindgen(js_name = "setCellCommas")]
    pub fn js_set_commas(
        &mut self,
        selection: String,
        commas: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_commas_selection(selection, commas, cursor)?;
        Ok(())
    }

    /// Sets cell bold formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setCellBold")]
    pub fn js_set_bold(
        &mut self,
        selection: String,
        bold: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_bold_selection(selection, bold, cursor)?;
        Ok(())
    }
    /// Sets cell italic formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setCellItalic")]
    pub fn js_set_italic(
        &mut self,
        selection: String,
        italic: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_italic_selection(selection, italic, cursor)?;
        Ok(())
    }

    /// Sets cell text color given as an optional [`String`].
    #[wasm_bindgen(js_name = "setCellTextColor")]
    pub fn js_set_text_color(
        &mut self,
        selection: String,
        text_color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_text_color_selection(selection, text_color, cursor)?;
        Ok(())
    }

    /// Sets cell fill color given as an optional [`String`].
    #[wasm_bindgen(js_name = "setCellFillColor")]
    pub fn js_fill_color(
        &mut self,
        selection: String,
        fill_color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_fill_color_selection(selection, fill_color, cursor)?;
        Ok(())
    }

    /// Sets cell render size (used for Html-style cells).
    #[wasm_bindgen(js_name = "setCellRenderSize")]
    pub fn js_set_render_size(
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
