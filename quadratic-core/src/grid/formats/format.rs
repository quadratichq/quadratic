//! This stores a format for Operations and eventually for the entire sheet.

use std::fmt::Display;

use serde::{Deserialize, Serialize};

use super::format_update::FormatUpdate;
use crate::grid::{CellAlign, CellVerticalAlign, CellWrap, NumericFormat};

#[derive(Default, Serialize, Deserialize, Debug, Clone, Eq, PartialEq, ts_rs::TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct Format {
    pub align: Option<CellAlign>,
    pub vertical_align: Option<CellVerticalAlign>,
    pub wrap: Option<CellWrap>,
    pub numeric_format: Option<NumericFormat>,
    pub numeric_decimals: Option<i16>,
    pub numeric_commas: Option<bool>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub text_color: Option<String>,
    pub fill_color: Option<String>,
    pub date_time: Option<String>,
    pub underline: Option<bool>,
    pub strike_through: Option<bool>,
}

impl Format {
    pub(crate) fn is_default(&self) -> bool {
        self.align.is_none()
            && self.vertical_align.is_none()
            && self.wrap.is_none()
            && self.numeric_format.is_none()
            && self.numeric_decimals.is_none()
            && self.numeric_commas.is_none()
            && self.bold.is_none()
            && self.italic.is_none()
            && self.text_color.is_none()
            && self.fill_color.is_none()
            && self.date_time.is_none()
            && self.underline.is_none()
            && self.strike_through.is_none()
    }

    #[cfg(test)]
    pub(crate) fn is_table_default(&self) -> bool {
        self.align.is_none()
            && self.vertical_align.is_none()
            && matches!(self.wrap, Some(CellWrap::Clip))
            && self.numeric_format.is_none()
            && self.numeric_decimals.is_none()
            && self.numeric_commas.is_none()
            && self.bold.is_none()
            && self.italic.is_none()
            && self.text_color.is_none()
            && self.fill_color.is_none()
            && self.date_time.is_none()
            && self.underline.is_none()
            && self.strike_through.is_none()
    }

    /// Clears all formatting.
    #[cfg(test)]
    pub(crate) fn clear(&mut self) {
        self.align = None;
        self.vertical_align = None;
        self.wrap = None;
        self.numeric_format = None;
        self.numeric_decimals = None;
        self.numeric_commas = None;
        self.bold = None;
        self.italic = None;
        self.text_color = None;
        self.fill_color = None;
        self.date_time = None;
        self.underline = None;
        self.strike_through = None;
    }

    /// Combines two formats. The first takes precedence over the second.
    pub(crate) fn combine(&self, other: &Format) -> Format {
        Format {
            align: self.align.or(other.align),
            vertical_align: self.vertical_align.or(other.vertical_align),
            wrap: self.wrap.or(other.wrap),
            numeric_format: self.numeric_format.clone().or(other.numeric_format.clone()),
            numeric_decimals: self.numeric_decimals.or(other.numeric_decimals),
            numeric_commas: self.numeric_commas.or(other.numeric_commas),
            bold: self.bold.or(other.bold),
            italic: self.italic.or(other.italic),
            text_color: self.text_color.clone().or(other.text_color.clone()),
            fill_color: self.fill_color.clone().or(other.fill_color.clone()),
            date_time: self.date_time.clone().or(other.date_time.clone()),
            underline: self.underline.or(other.underline),
            strike_through: self.strike_through.or(other.strike_through),
        }
    }
}

impl Display for Format {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut s = String::new();
        if let Some(align) = self.align {
            s.push_str(&format!("align: {align:?}, "));
        }
        if let Some(wrap) = self.wrap {
            s.push_str(&format!("wrap: {wrap:?}, "));
        }
        if let Some(numeric_format) = &self.numeric_format {
            s.push_str(&format!("numeric_format: {numeric_format:?}, "));
        }
        if let Some(numeric_decimals) = self.numeric_decimals {
            s.push_str(&format!("numeric_decimals: {numeric_decimals:?}, "));
        }
        if let Some(numeric_commas) = self.numeric_commas {
            s.push_str(&format!("numeric_commas: {numeric_commas:?}, "));
        }
        if let Some(bold) = self.bold {
            s.push_str(&format!("bold: {bold:?}, "));
        }
        if let Some(italic) = self.italic {
            s.push_str(&format!("italic: {italic:?}, "));
        }
        if let Some(text_color) = &self.text_color {
            s.push_str(&format!("text_color: {text_color:?}, "));
        }
        if let Some(fill_color) = &self.fill_color {
            s.push_str(&format!("fill_color: {fill_color:?}, "));
        }
        if let Some(date_time) = &self.date_time {
            s.push_str(&format!("date_time: {date_time:?}, "));
        }
        if let Some(underline) = self.underline {
            s.push_str(&format!("underline: {underline:?}, "));
        }
        if let Some(strike_through) = self.strike_through {
            s.push_str(&format!("strike_through: {strike_through:?}, "));
        }
        write!(f, "{s}")
    }
}

/// Converts a &Format to a FormatUpdate.
impl From<&Format> for FormatUpdate {
    fn from(format: &Format) -> Self {
        Self {
            align: format.align.map(Some),
            vertical_align: format.vertical_align.map(Some),
            wrap: format.wrap.map(Some),
            numeric_format: format.numeric_format.clone().map(Some),
            numeric_decimals: format.numeric_decimals.map(Some),
            numeric_commas: format.numeric_commas.map(Some),
            bold: format.bold.map(Some),
            italic: format.italic.map(Some),
            text_color: format.text_color.clone().map(Some),
            fill_color: format.fill_color.clone().map(Some),
            render_size: None,
            date_time: format.date_time.clone().map(Some),
            underline: format.underline.map(Some),
            strike_through: format.strike_through.map(Some),
        }
    }
}

/// Converts a Format to a FormatUpdate.
impl From<Format> for FormatUpdate {
    fn from(format: Format) -> Self {
        Self {
            align: format.align.map(Some),
            vertical_align: format.vertical_align.map(Some),
            wrap: format.wrap.map(Some),
            numeric_format: format.numeric_format.clone().map(Some),
            numeric_decimals: format.numeric_decimals.map(Some),
            numeric_commas: format.numeric_commas.map(Some),
            bold: format.bold.map(Some),
            italic: format.italic.map(Some),
            text_color: format.text_color.clone().map(Some),
            fill_color: format.fill_color.clone().map(Some),
            render_size: None,
            date_time: format.date_time.clone().map(Some),
            underline: format.underline.map(Some),
            strike_through: format.strike_through.map(Some),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::grid::{CellAlign, CellWrap, NumericFormat, NumericFormatKind};

    #[test]
    fn is_default() {
        let format = Format::default();
        assert!(format.is_default());
    }

    #[test]
    fn clear() {
        let mut format = Format {
            align: Some(CellAlign::Center),
            vertical_align: Some(CellVerticalAlign::Middle),
            wrap: Some(CellWrap::Wrap),
            numeric_format: Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }),
            numeric_decimals: Some(2),
            numeric_commas: Some(true),
            bold: Some(true),
            italic: Some(true),
            text_color: Some("red".to_string()),
            fill_color: Some("blue".to_string()),
            date_time: Some("%H".to_string()),
            underline: Some(true),
            strike_through: Some(true),
        };

        format.clear();

        assert_eq!(format.align, None);
        assert_eq!(format.vertical_align, None);
        assert_eq!(format.wrap, None);
        assert_eq!(format.numeric_format, None);
        assert_eq!(format.numeric_decimals, None);
        assert_eq!(format.numeric_commas, None);
        assert_eq!(format.bold, None);
        assert_eq!(format.italic, None);
        assert_eq!(format.text_color, None);
        assert_eq!(format.fill_color, None);
        assert_eq!(format.date_time, None);
        assert_eq!(format.underline, None);
        assert_eq!(format.strike_through, None);
    }

    #[test]
    fn format_to_format_update_ref() {
        let format = Format {
            align: Some(CellAlign::Center),
            vertical_align: Some(CellVerticalAlign::Middle),
            wrap: Some(CellWrap::Wrap),
            numeric_format: Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }),
            numeric_decimals: Some(2),
            numeric_commas: Some(true),
            bold: Some(true),
            italic: Some(true),
            text_color: Some("red".to_string()),
            fill_color: Some("blue".to_string()),
            date_time: Some("%H".to_string()),
            underline: Some(true),
            strike_through: Some(true),
        };

        let update: FormatUpdate = (&format).into();

        assert_eq!(update.align, Some(Some(CellAlign::Center)));
        assert_eq!(update.vertical_align, Some(Some(CellVerticalAlign::Middle)));
        assert_eq!(update.wrap, Some(Some(CellWrap::Wrap)));
        assert_eq!(
            update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string())
            }))
        );
        assert_eq!(update.numeric_decimals, Some(Some(2)));
        assert_eq!(update.numeric_commas, Some(Some(true)));
        assert_eq!(update.bold, Some(Some(true)));
        assert_eq!(update.italic, Some(Some(true)));
        assert_eq!(update.text_color, Some(Some("red".to_string())));
        assert_eq!(update.fill_color, Some(Some("blue".to_string())));
        assert_eq!(update.date_time, Some(Some("%H".to_string())));
        assert_eq!(update.underline, Some(Some(true)));
        assert_eq!(update.strike_through, Some(Some(true)));
    }

    #[test]
    fn format_to_format_update() {
        let format = Format {
            align: Some(CellAlign::Center),
            vertical_align: Some(CellVerticalAlign::Middle),
            wrap: Some(CellWrap::Wrap),
            numeric_format: Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }),
            numeric_decimals: Some(2),
            numeric_commas: Some(true),
            bold: Some(true),
            italic: Some(true),
            text_color: Some("red".to_string()),
            fill_color: Some("blue".to_string()),
            date_time: Some("%H".to_string()),
            underline: Some(true),
            strike_through: Some(true),
        };

        let update: FormatUpdate = format.into();

        assert_eq!(update.align, Some(Some(CellAlign::Center)));
        assert_eq!(update.vertical_align, Some(Some(CellVerticalAlign::Middle)));
        assert_eq!(update.wrap, Some(Some(CellWrap::Wrap)));
        assert_eq!(
            update.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string())
            }))
        );
        assert_eq!(update.numeric_decimals, Some(Some(2)));
        assert_eq!(update.numeric_commas, Some(Some(true)));
        assert_eq!(update.bold, Some(Some(true)));
        assert_eq!(update.italic, Some(Some(true)));
        assert_eq!(update.text_color, Some(Some("red".to_string())));
        assert_eq!(update.fill_color, Some(Some("blue".to_string())));
        assert_eq!(update.date_time, Some(Some("%H".to_string())));
        assert_eq!(update.underline, Some(Some(true)));
        assert_eq!(update.strike_through, Some(Some(true)));
    }

    #[test]
    fn test_combine() {
        let format = Format {
            align: Some(CellAlign::Center),
            italic: Some(true),
            ..Default::default()
        };
        let format2 = Format {
            align: Some(CellAlign::Right),
            bold: Some(true),
            ..Default::default()
        };
        assert_eq!(
            format.combine(&format2),
            Format {
                align: Some(CellAlign::Center),
                italic: Some(true),
                bold: Some(true),
                ..Default::default()
            }
        );
    }
}
