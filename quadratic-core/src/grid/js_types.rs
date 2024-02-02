use std::ops::{BitOr, BitOrAssign};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

use super::formatting::{BoolSummary, CellAlign, CellWrap};
use super::CodeCellLanguage;
use crate::controller::transaction_summary::TransactionSummary;
use crate::grid::BorderStyle;
use crate::Pos;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum JsRenderCellSpecial {
    Chart,
    SpillError,
    RunError,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct JsRenderCell {
    pub x: i64,
    pub y: i64,

    pub value: String,

    /// Code language, set only for the top left cell of a code output.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<CodeCellLanguage>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<CellAlign>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrap: Option<CellWrap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,

    pub special: Option<JsRenderCellSpecial>,
}

#[cfg(test)]
impl JsRenderCell {
    pub fn new_number(x: i64, y: i64, value: isize, language: Option<CodeCellLanguage>) -> Self {
        Self {
            x,
            y,
            value: value.to_string(),
            language,
            align: Some(CellAlign::Right),
            wrap: None,
            bold: None,
            italic: None,
            text_color: None,
            special: None,
        }
    }
}

impl From<Pos> for JsRenderCell {
    fn from(pos: Pos) -> Self {
        Self {
            x: pos.x,
            y: pos.y,
            value: "".to_string(),
            language: None,
            align: None,
            wrap: None,
            bold: None,
            italic: None,
            text_color: None,
            special: None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsRenderFill {
    pub x: i64,
    pub y: i64,
    pub w: u32,
    pub h: u32,

    pub color: String,
}

#[derive(Debug, PartialEq)]
#[wasm_bindgen]
pub struct JsRenderBorders {
    horizontal: Vec<JsRenderBorder>,
    vertical: Vec<JsRenderBorder>,
    index_horizontal: u32,
    index_vertical: u32,
}

impl JsRenderBorders {
    pub fn new(horizontal: Vec<JsRenderBorder>, vertical: Vec<JsRenderBorder>) -> Self {
        JsRenderBorders {
            horizontal,
            vertical,
            index_horizontal: 0,
            index_vertical: 0,
        }
    }
    pub fn get_horizontal(&self) -> &[JsRenderBorder] {
        &self.horizontal
    }
    pub fn get_vertical(&self) -> &[JsRenderBorder] {
        &self.vertical
    }
}
#[wasm_bindgen]
impl JsRenderBorders {
    #[wasm_bindgen]
    pub fn horizontal_next(&mut self) -> Option<JsRenderBorder> {
        let ret = self.horizontal.get(self.index_horizontal as usize).cloned();
        self.index_horizontal += 1;
        ret
    }
    #[wasm_bindgen]
    pub fn vertical_next(&mut self) -> Option<JsRenderBorder> {
        let ret = self.vertical.get(self.index_vertical as usize).cloned();
        self.index_vertical += 1;
        ret
    }
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.index_horizontal = 0;
        self.index_vertical = 0;
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Eq, PartialEq, Hash)]
#[wasm_bindgen]
pub struct JsRenderBorder {
    pub x: i64,
    pub y: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub w: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<usize>,
    pub style: BorderStyle,
}

impl JsRenderBorder {
    pub fn new(x: i64, y: i64, w: Option<usize>, h: Option<usize>, style: BorderStyle) -> Self {
        Self { x, y, w, h, style }
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct CellFormatSummary {
    pub bold: Option<bool>,
    pub italic: Option<bool>,

    pub text_color: Option<String>,
    pub fill_color: Option<String>,
}
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct FormattingSummary {
    pub bold: BoolSummary,
    pub italic: BoolSummary,
}
impl BitOr for FormattingSummary {
    type Output = Self;

    fn bitor(self, rhs: Self) -> Self::Output {
        FormattingSummary {
            bold: self.bold | rhs.bold,
            italic: self.italic | rhs.italic,
        }
    }
}
impl BitOrAssign for FormattingSummary {
    fn bitor_assign(&mut self, rhs: Self) {
        *self = self.clone() | rhs;
    }
}

#[derive(Serialize, PartialEq, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsCodeCell {
    pub x: i64,
    pub y: i64,
    pub code_string: String,
    pub language: CodeCellLanguage,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub evaluation_result: Option<String>,
    pub spill_error: Option<Vec<Pos>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsRenderCodeCell {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
    pub language: CodeCellLanguage,
    pub state: JsRenderCodeCellState,
    pub spill_error: Option<Vec<Pos>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsHtmlOutput {
    pub sheet_id: String,
    pub x: i64,
    pub y: i64,
    pub html: String,
    pub w: Option<String>,
    pub h: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum JsRenderCodeCellState {
    NotYetRun,
    RunError,
    SpillError,
    Success,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct JsClipboard {
    pub summary: Option<TransactionSummary>,
    pub plain_text: String,
    pub html: String,
}
