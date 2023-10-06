use std::ops::{BitOr, BitOrAssign};

use serde::{Deserialize, Serialize};

use super::borders::CellBorder;
use super::formatting::{BoolSummary, CellAlign, CellWrap};
use super::CodeCellLanguage;
use crate::controller::transactions::TransactionSummary;
use crate::Pos;

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill_color: Option<String>, // TODO: remove (needed for exporting to old file format)
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
            fill_color: None,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsRenderBorder {
    pub x: i64,
    pub y: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub w: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<usize>,
    pub style: CellBorder,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellForArray {
    pub x: i64,
    pub y: i64,
    pub value: String,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsRenderCodeCell {
    pub x: i64,
    pub y: i64,
    pub w: u32,
    pub h: u32,
    pub language: CodeCellLanguage,
    pub state: JsRenderCodeCellState,
}

#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum JsRenderCodeCellState {
    #[default]
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
