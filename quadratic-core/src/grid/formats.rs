//! This is a replacement for CellFmtArray for use within Operation::SetFormatSelection

use std::ops::{Deref, DerefMut};

use super::{CellAlign, CellWrap, NumericFormat, RenderSize};
use crate::RunLengthEncoding;
use serde::{Deserialize, Serialize};

#[derive(Default, Serialize, Deserialize, Debug, Clone, Eq, PartialEq)]
pub struct Format {
    pub align: Option<CellAlign>,
    pub wrap: Option<CellWrap>,
    pub numeric_format: Option<NumericFormat>,
    pub numeric_decimals: Option<i16>,
    pub numeric_commas: Option<bool>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub text_color: Option<String>,
    pub fill_color: Option<String>,
    pub render_size: Option<RenderSize>,
}

impl Format {
    pub fn is_default(&self) -> bool {
        self.align.is_none()
            && self.wrap.is_none()
            && self.numeric_format.is_none()
            && self.numeric_decimals.is_none()
            && self.numeric_commas.is_none()
            && self.bold.is_none()
            && self.italic.is_none()
            && self.text_color.is_none()
            && self.fill_color.is_none()
            && self.render_size.is_none()
    }

    /// Merges a FormatUpdate into this Format, returning a FormatUpdate to undo the change.
    pub fn merge_update(&mut self, update: &FormatUpdate) -> FormatUpdate {
        let mut old = FormatUpdate::default();
        if let Some(align) = update.align {
            old.align = Some(self.align);
            self.align = align;
        }
        if let Some(wrap) = update.wrap {
            old.wrap = Some(self.wrap);
            self.wrap = wrap;
        }
        if let Some(numeric_format) = update.numeric_format.as_ref() {
            old.numeric_format = Some(self.numeric_format.as_ref().map(|n| n.clone()));
            self.numeric_format = numeric_format.clone();
        }
        if let Some(numeric_decimals) = update.numeric_decimals {
            old.numeric_decimals = Some(self.numeric_decimals);
            self.numeric_decimals = numeric_decimals;
        }
        if let Some(numeric_commas) = update.numeric_commas {
            old.numeric_commas = Some(self.numeric_commas);
            self.numeric_commas = numeric_commas;
        }
        if let Some(bold) = update.bold {
            old.bold = Some(self.bold);
            self.bold = bold;
        }
        if let Some(italic) = update.italic {
            old.italic = Some(self.italic);
            self.italic = italic;
        }
        if let Some(text_color) = update.text_color.as_ref() {
            old.text_color = Some(self.text_color.clone());
            self.text_color = text_color.clone();
        }
        if let Some(fill_color) = update.fill_color.as_ref() {
            old.fill_color = Some(self.fill_color.clone());
            self.fill_color = fill_color.clone();
        }
        if let Some(render_size) = update.render_size.as_ref() {
            old.render_size = Some(self.render_size.clone());
            self.render_size = render_size.clone();
        }
        old
    }

    /// Clears all formatting.
    pub fn clear(&mut self) {
        self.align = None;
        self.wrap = None;
        self.numeric_format = None;
        self.numeric_decimals = None;
        self.numeric_commas = None;
        self.bold = None;
        self.italic = None;
        self.text_color = None;
        self.fill_color = None;
        self.render_size = None;
    }
}

/// Converts a &Format to a FormatUpdate.
impl From<&Format> for FormatUpdate {
    fn from(format: &Format) -> Self {
        Self {
            align: format.align.map(Some),
            wrap: format.wrap.map(Some),
            numeric_format: format.numeric_format.clone().map(Some),
            numeric_decimals: format.numeric_decimals.map(Some),
            numeric_commas: format.numeric_commas.map(Some),
            bold: format.bold.map(Some),
            italic: format.italic.map(Some),
            text_color: format.text_color.clone().map(Some),
            fill_color: format.fill_color.clone().map(Some),
            render_size: format.render_size.clone().map(Some),
        }
    }
}

/// Used to store changes from a Format to another Format.
#[derive(Default, Serialize, Deserialize, Debug, Clone, Eq, PartialEq)]
pub struct FormatUpdate {
    pub align: Option<Option<CellAlign>>,
    pub wrap: Option<Option<CellWrap>>,
    pub numeric_format: Option<Option<NumericFormat>>,
    pub numeric_decimals: Option<Option<i16>>,
    pub numeric_commas: Option<Option<bool>>,
    pub bold: Option<Option<bool>>,
    pub italic: Option<Option<bool>>,
    pub text_color: Option<Option<String>>,
    pub fill_color: Option<Option<String>>,
    pub render_size: Option<Option<RenderSize>>,
}

impl FormatUpdate {
    pub fn is_default(&self) -> bool {
        self.align.is_none()
            && self.wrap.is_none()
            && self.numeric_format.is_none()
            && self.numeric_decimals.is_none()
            && self.numeric_commas.is_none()
            && self.bold.is_none()
            && self.italic.is_none()
            && self.text_color.is_none()
            && self.fill_color.is_none()
            && self.render_size.is_none()
    }
}

/// Converts a FormatUpdate to a Format.
impl From<&FormatUpdate> for Format {
    fn from(update: &FormatUpdate) -> Self {
        Self {
            align: update.align.unwrap_or(None),
            wrap: update.wrap.unwrap_or(None),
            numeric_format: update.numeric_format.clone().unwrap_or(None),
            numeric_decimals: update.numeric_decimals.unwrap_or(None),
            numeric_commas: update.numeric_commas.unwrap_or(None),
            bold: update.bold.unwrap_or(None),
            italic: update.italic.unwrap_or(None),
            text_color: update.text_color.clone().unwrap_or(None),
            fill_color: update.fill_color.clone().unwrap_or(None),
            render_size: update.render_size.clone().unwrap_or(None),
        }
    }
}

/// Used to store changes from a Format to another Format.
#[derive(Default, Serialize, Deserialize, Debug, Clone, Eq, PartialEq)]
pub struct Formats {
    pub formats: RunLengthEncoding<FormatUpdate>,
}

impl Formats {
    pub fn repeat(update: FormatUpdate, count: usize) -> Self {
        let mut formats = Formats::default();
        formats.push_n(update, count);
        formats
    }
}

impl Deref for Formats {
    type Target = RunLengthEncoding<FormatUpdate>;

    fn deref(&self) -> &Self::Target {
        &self.formats
    }
}

impl DerefMut for Formats {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.formats
    }
}

#[cfg(test)]
mod test {
    use super::Format;
    use crate::grid::{CellAlign, CellWrap, NumericFormat, NumericFormatKind, RenderSize};

    #[test]
    fn is_default() {
        let format = super::Format::default();
        assert!(format.is_default());
    }

    #[test]
    fn clear() {
        let mut format = Format {
            align: Some(CellAlign::Center),
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
            render_size: Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
        };

        format.clear();

        assert_eq!(format.align, None);
        assert_eq!(format.wrap, None);
        assert_eq!(format.numeric_format, None);
        assert_eq!(format.numeric_decimals, None);
        assert_eq!(format.numeric_commas, None);
        assert_eq!(format.bold, None);
        assert_eq!(format.italic, None);
        assert_eq!(format.text_color, None);
        assert_eq!(format.fill_color, None);
        assert_eq!(format.render_size, None);
    }

    #[test]
    fn merge_update() {
        let mut format = Format::default();
        let update = super::FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            wrap: Some(Some(CellWrap::Wrap)),
            numeric_format: Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            })),
            numeric_decimals: Some(Some(2)),
            numeric_commas: Some(Some(true)),
            bold: Some(Some(true)),
            italic: Some(Some(true)),
            text_color: Some(Some("red".to_string())),
            fill_color: Some(Some("blue".to_string())),
            render_size: Some(Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            })),
        };

        let old = format.merge_update(&update);

        assert_eq!(format.align, Some(CellAlign::Center));
        assert_eq!(format.wrap, Some(CellWrap::Wrap));
        assert_eq!(
            format.numeric_format,
            Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".into())
            })
        );
        assert_eq!(format.numeric_decimals, Some(2));
        assert_eq!(format.numeric_commas, Some(true));
        assert_eq!(format.bold, Some(true));
        assert_eq!(format.italic, Some(true));
        assert_eq!(format.text_color, Some("red".to_string()));
        assert_eq!(format.fill_color, Some("blue".to_string()));
        assert_eq!(
            format.render_size,
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string()
            })
        );

        let undo = format.merge_update(&old);
        assert!(format.is_default());
        assert_eq!(undo, update);
    }
}
