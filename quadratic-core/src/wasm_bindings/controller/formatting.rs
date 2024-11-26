use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns a summary of the formatting in a region as a
    /// [`CellFormatSummary`].
    #[wasm_bindgen(js_name = "getCellFormatSummary")]
    pub fn js_cell_format_summary(
        &self,
        sheet_id: String,
        pos: String,
        _include_sheet_info: bool, // TODO: remove this parameter
    ) -> Result<JsValue, JsValue> {
        let pos: Pos = serde_json::from_str(&pos).map_err(|_| JsValue::UNDEFINED)?;
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Result::Err("Sheet not found".into());
        };
        let output: CellFormatSummary = sheet.cell_format_summary(pos);
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
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let align = serde_wasm_bindgen::from_value(align).map_err(|_| "Invalid align")?;
        self.set_align_selection(selection, align, cursor)
    }

    /// Sets cell vertical align formatting given as an optional [`CellVerticalAlign`].
    #[wasm_bindgen(js_name = "setCellVerticalAlign")]
    pub fn js_set_cell_vertical_align(
        &mut self,
        selection: String,
        vertical_align: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let vertical_align =
            serde_wasm_bindgen::from_value(vertical_align).map_err(|_| "Invalid vertical align")?;
        self.set_vertical_align_selection(selection, vertical_align, cursor)
    }

    /// Sets cell wrap formatting given as an optional [`CellWrap`].
    #[wasm_bindgen(js_name = "setCellWrap")]
    pub fn js_set_cell_wrap(
        &mut self,
        selection: String,
        wrap: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let wrap = serde_wasm_bindgen::from_value(wrap).map_err(|_| "Invalid wrap")?;
        self.set_cell_wrap_selection(selection, wrap, cursor)
    }

    /// Sets cells numeric_format to normal
    #[wasm_bindgen(js_name = "removeCellNumericFormat")]
    pub fn js_remove_numeric_format(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
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
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_currency_selection(&selection, symbol, cursor)?;
        Ok(())
    }

    /// Sets cells numeric_format to percentage
    #[wasm_bindgen(js_name = "setCellPercentage")]
    pub fn js_set_percentage(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
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
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
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
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
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
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
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
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
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
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
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
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_fill_color_selection(selection, fill_color, cursor)?;
        Ok(())
    }

    /// Sets cell render size (used for Html-style cells).
    #[wasm_bindgen(js_name = "setCellRenderSize")]
    pub fn js_set_render_size(
        &mut self,
        sheet_id: String,
        rect: String,
        w: Option<String>,
        h: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let rect = serde_json::from_str::<Rect>(&rect).map_err(|_| "Invalid rect")?;
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

    #[wasm_bindgen(js_name = "setDateTimeFormat")]
    pub fn js_set_date_time_format(
        &mut self,
        selection: String,
        date_time: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_date_time_format(selection, date_time, cursor)
    }

    /// Changes cell numeric decimals.
    #[wasm_bindgen(js_name = "changeDecimalPlaces")]
    pub fn js_change_decimal_places(
        &mut self,
        selection: String,
        delta: u32,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.change_decimal_places_selection(selection, delta, cursor)?;
        Ok(())
    }

    /// Sets cell bold formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setCellUnderline")]
    pub fn js_set_underline(
        &mut self,
        selection: String,
        underline: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_underline_selection(selection, underline, cursor)?;
        Ok(())
    }

    /// Sets cell bold formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setCellStrikeThrough")]
    pub fn js_set_strike_through(
        &mut self,
        selection: String,
        strike_through: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.set_strike_through_selection(selection, strike_through, cursor)?;
        Ok(())
    }

    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "clearFormatting")]
    pub fn js_clear_formatting(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.clear_format(&selection, cursor)
    }

    #[wasm_bindgen(js_name = "getFormatAll")]
    pub fn js_get_format_all(&self, sheet_id: String) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|_| JsValue::UNDEFINED)?;
        let sheet = self.try_sheet(sheet_id).ok_or(JsValue::UNDEFINED)?;
        serde_json::to_string(&sheet.format_all()).map_err(|_| JsValue::UNDEFINED)
    }

    #[wasm_bindgen(js_name = "getFormatColumn")]
    pub fn js_get_format_column(&self, sheet_id: String, column: i32) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|_| JsValue::UNDEFINED)?;
        let sheet = self.try_sheet(sheet_id).ok_or(JsValue::UNDEFINED)?;
        serde_json::to_string(&sheet.format_column(column as _)).map_err(|_| JsValue::UNDEFINED)
    }

    #[wasm_bindgen(js_name = "getFormatRow")]
    pub fn js_get_format_row(&self, sheet_id: String, row: i32) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|_| JsValue::UNDEFINED)?;
        let sheet = self.try_sheet(sheet_id).ok_or(JsValue::UNDEFINED)?;
        serde_json::to_string(&sheet.format_row(row as _)).map_err(|_| JsValue::UNDEFINED)
    }

    #[wasm_bindgen(js_name = "getFormatCell")]
    pub fn js_get_format_cell(&self, sheet_id: String, x: i32, y: i32) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|_| JsValue::UNDEFINED)?;
        let sheet = self.try_sheet(sheet_id).ok_or(JsValue::UNDEFINED)?;
        serde_json::to_string(&sheet.format_cell(x as i64, y as i64, false))
            .map_err(|_| JsValue::UNDEFINED)
    }
}
