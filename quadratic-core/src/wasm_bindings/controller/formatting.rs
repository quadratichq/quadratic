use std::str::FromStr;

use wasm_bindgen::prelude::*;

use crate::Pos;
use crate::SheetPos;
use crate::a1::A1Selection;
use crate::controller::GridController;
use crate::grid::Format;
use crate::grid::formats::FormatUpdate;
use crate::wasm_bindings::capture_core_error;

use super::CellFormatSummary;
use super::NumericFormatKind;
use super::SheetId;

#[wasm_bindgen]
impl GridController {
    /// Returns a summary of the formatting in a region as a
    /// [`CellFormatSummary`].
    #[wasm_bindgen(js_name = "getCellFormatSummary")]
    pub fn js_cell_format_summary(&self, sheet_id: String, pos: String) -> JsValue {
        let Ok(pos) = serde_json::from_str::<Pos>(&pos) else {
            return JsValue::UNDEFINED;
        };
        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return JsValue::UNDEFINED;
        };
        let output: CellFormatSummary = sheet.cell_format_summary(pos);
        serde_wasm_bindgen::to_value(&output).unwrap_or(JsValue::UNDEFINED)
    }

    /// Sets cell align formatting given as an optional [`CellAlign`].
    #[wasm_bindgen(js_name = "setAlign")]
    pub fn js_set_align(
        &mut self,
        selection: String,
        align: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        let align = serde_wasm_bindgen::from_value(align).map_err(|_| "Invalid align")?;
        self.set_align(&selection, align, cursor)
    }

    /// Sets cell vertical align formatting given as an optional [`CellVerticalAlign`].
    #[wasm_bindgen(js_name = "setVerticalAlign")]
    pub fn js_set_vertical_align(
        &mut self,
        selection: String,
        vertical_align: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        let vertical_align =
            serde_wasm_bindgen::from_value(vertical_align).map_err(|_| "Invalid vertical align")?;
        self.set_vertical_align(&selection, vertical_align, cursor)
    }

    /// Sets cell wrap formatting given as an optional [`CellWrap`].
    #[wasm_bindgen(js_name = "setWrap")]
    pub fn js_set_wrap(
        &mut self,
        selection: String,
        wrap: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        let wrap = serde_wasm_bindgen::from_value(wrap).map_err(|_| "Invalid wrap")?;
        self.set_cell_wrap(&selection, wrap, cursor)
    }

    /// Sets cells numeric_format to normal
    #[wasm_bindgen(js_name = "removeNumericFormat")]
    pub fn js_remove_numeric_format(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.remove_number_formatting(&selection, cursor)?;
        Ok(())
    }

    /// Sets cells numeric_format to currency
    #[wasm_bindgen(js_name = "setCurrency")]
    pub fn js_set_currency(
        &mut self,
        selection: String,
        symbol: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_currency(&selection, symbol, cursor)?;
        Ok(())
    }

    /// Sets cells numeric_format to percentage
    #[wasm_bindgen(js_name = "setPercentage")]
    pub fn js_set_percentage(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_numeric_format(&selection, NumericFormatKind::Percentage, None, cursor)?;
        Ok(())
    }

    /// Sets cells numeric_format to scientific notation
    #[wasm_bindgen(js_name = "setExponential")]
    pub fn js_set_exponential(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_numeric_format(&selection, NumericFormatKind::Exponential, None, cursor)?;
        Ok(())
    }

    /// Sets cells numeric_commas
    #[wasm_bindgen(js_name = "setCommas")]
    pub fn js_set_commas(
        &mut self,
        selection: String,
        commas: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_commas(&selection, commas, cursor)?;
        Ok(())
    }

    /// Sets cell bold formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setBold")]
    pub fn js_set_bold(
        &mut self,
        selection: String,
        bold: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_bold(&selection, bold, cursor)?;
        Ok(())
    }
    /// Sets cell italic formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setItalic")]
    pub fn js_set_italic(
        &mut self,
        selection: String,
        italic: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_italic(&selection, italic, cursor)?;
        Ok(())
    }

    /// Sets cell text color given as an optional [`String`].
    #[wasm_bindgen(js_name = "setTextColor")]
    pub fn js_set_text_color(
        &mut self,
        selection: String,
        text_color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_text_color(&selection, text_color, cursor)?;
        Ok(())
    }

    /// Sets cell fill color given as an optional [`String`].
    #[wasm_bindgen(js_name = "setFillColor")]
    pub fn js_set_fill_color(
        &mut self,
        selection: String,
        fill_color: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_fill_color(&selection, fill_color, cursor)?;
        Ok(())
    }

    /// Sets cell render size (used for Html-style cells).
    #[wasm_bindgen(js_name = "setChartSize")]
    pub fn js_set_chart_size(
        &mut self,
        sheet_pos: String,
        columns: i32,
        rows: i32,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            if columns <= 0 || rows <= 0 {
                return Err("Invalid chart size".to_string());
            }

            let sheet_pos =
                serde_json::from_str::<SheetPos>(&sheet_pos).map_err(|_| "Invalid sheet pos")?;
            self.set_chart_size(sheet_pos, columns as u32, rows as u32, cursor);
            Ok(None)
        })
    }

    #[wasm_bindgen(js_name = "setDateTimeFormat")]
    pub fn js_set_date_time_format(
        &mut self,
        selection: String,
        date_time: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_date_time_format(&selection, date_time, cursor)?;
        Ok(())
    }

    /// Changes cell numeric decimals.
    #[wasm_bindgen(js_name = "changeDecimalPlaces")]
    pub fn js_change_decimal_places(
        &mut self,
        selection: String,
        delta: i32,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.change_decimal_places(&selection, delta, cursor)?;
        Ok(())
    }

    /// Sets cell bold formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setUnderline")]
    pub fn js_set_underline(
        &mut self,
        selection: String,
        underline: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_underline(&selection, underline, cursor)?;
        Ok(())
    }

    /// Sets cell bold formatting given as an optional [`bool`].
    #[wasm_bindgen(js_name = "setStrikeThrough")]
    pub fn js_set_strike_through(
        &mut self,
        selection: String,
        strike_through: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        self.set_strike_through(&selection, strike_through, cursor)?;
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
        self.clear_format_borders(&selection, cursor);
        Ok(())
    }

    #[wasm_bindgen(js_name = "getFormatSelection")]
    pub fn js_get_format_selection(&self, selection: String) -> JsValue {
        capture_core_error(|| {
            let selection = serde_json::from_str::<A1Selection>(&selection)
                .map_err(|_| "Unable to parse A1Selection")?;

            let sheet = self
                .try_sheet(selection.sheet_id)
                .ok_or("Invalid sheet ID")?;

            let format = sheet.format_selection(&selection, self.a1_context());
            match serde_wasm_bindgen::to_value(&format) {
                Ok(value) => Ok(Some(value)),
                Err(e) => Err(e.to_string()),
            }
        })
    }

    #[wasm_bindgen(js_name = "setFormats")]
    pub fn js_set_formats(
        &mut self,
        sheet_id: String,
        selection: String,
        formats: String,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id).map_err(|_| "Invalid sheet ID")?;

            let selection = A1Selection::parse_a1(&selection, sheet_id, self.a1_context())
                .map_err(|_| "Invalid selection")?;

            let format = serde_json::from_str::<Format>(&formats).map_err(|_| "Invalid formats")?;

            let mut format_update = FormatUpdate::from(format);

            // handle clear text and fill color properly
            if format_update
                .text_color
                .as_ref()
                .is_some_and(|color| color.as_ref().is_some_and(|color| color.is_empty()))
            {
                format_update.text_color = Some(None);
            }

            if format_update
                .fill_color
                .as_ref()
                .is_some_and(|color| color.as_ref().is_some_and(|color| color.is_empty()))
            {
                format_update.fill_color = Some(None);
            }

            self.set_formats(&selection, format_update);
            Ok(None)
        })
    }
}
