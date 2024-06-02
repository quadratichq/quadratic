//! This is used to update a format. Only the fields that are Some(_) will be updated.

use serde::{Deserialize, Serialize};
use crate::grid::{CellAlign, CellWrap, NumericFormat, RenderSize};
use super::format::Format;

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
    /// Returns a FormatUpdate with all fields set to Some(None). This is used
    /// to clear a format.
    pub fn cleared() -> Self {
        Self {
            align: Some(None),
            wrap: Some(None),
            numeric_format: Some(None),
            numeric_decimals: Some(None),
            numeric_commas: Some(None),
            bold: Some(None),
            italic: Some(None),
            text_color: Some(None),
            fill_color: Some(None),
            render_size: Some(None),
        }
    }

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

    /// Whether we need to send a client html update.
    pub fn html_changed(&self) -> bool {
        self.render_size.is_some()
    }

    /// Whether we need to send a render cell update.
    pub fn render_cells_changed(&self) -> bool {
        self.align.is_some()
            || self.wrap.is_some()
            || self.numeric_format.is_some()
            || self.numeric_decimals.is_some()
            || self.numeric_commas.is_some()
            || self.bold.is_some()
            || self.italic.is_some()
            || self.text_color.is_some()
    }

    pub fn fill_changed(&self) -> bool {
        self.fill_color.is_some()
    }

    pub fn combine(&self, other: &FormatUpdate) -> FormatUpdate {
        let mut update = FormatUpdate::default();
        update.align = self.align.or(other.align);
        update.wrap = self.wrap.or(other.wrap);
        update.numeric_format = self.numeric_format.clone().or(other.numeric_format.clone());
        update.numeric_decimals = self.numeric_decimals.or(other.numeric_decimals);
        update.numeric_commas = self.numeric_commas.or(other.numeric_commas);
        update.bold = self.bold.or(other.bold);
        update.italic = self.italic.or(other.italic);
        update.text_color = self.text_color.clone().or(other.text_color.clone());
        update.fill_color = self.fill_color.clone().or(other.fill_color.clone());
        update.render_size = self.render_size.clone().or(other.render_size.clone());
        update
    }

    /// Returns whether this update will require a re-render for cells.
    pub fn needs_render_cells(&self) -> bool {
        self.align.is_some()
            || self.wrap.is_some()
            || self.numeric_format.is_some()
            || self.numeric_decimals.is_some()
            || self.numeric_commas.is_some()
            || self.bold.is_some()
            || self.italic.is_some()
            || self.text_color.is_some()
    }

    /// Returns a FormatUpdate that will clear a given update
    pub fn clear_update(&self) -> FormatUpdate {
        let mut clear = FormatUpdate::default();
        if self.align.is_some() {
            clear.align = Some(None);
        }
        if self.wrap.is_some() {
            clear.wrap = Some(None);
        }
        if self.numeric_format.is_some() {
            clear.numeric_format = Some(None);
        }
        if self.numeric_decimals.is_some() {
            clear.numeric_decimals = Some(None);
        }
        if self.numeric_commas.is_some() {
            clear.numeric_commas = Some(None);
        }
        if self.bold.is_some() {
            clear.bold = Some(None);
        }
        if self.italic.is_some() {
            clear.italic = Some(None);
        }
        if self.text_color.is_some() {
            clear.text_color = Some(None);
        }
        if self.fill_color.is_some() {
            clear.fill_color = Some(None);
        }
        if self.render_size.is_some() {
            clear.render_size = Some(None);
        }
        clear
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

#[cfg(test)]
mod tests {
    use crate::grid::NumericFormatKind;
    use super::*;

    #[test]
    fn format_update_to_format() {
        let update = FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            wrap: Some(Some(CellWrap::Overflow)),
            numeric_format: Some(Some(NumericFormat { kind: NumericFormatKind::Currency, symbol: None })),
            numeric_decimals: Some(Some(2)),
            numeric_commas: Some(Some(true)),
            bold: Some(Some(true)),
            italic: Some(Some(true)),
            text_color: Some(Some("red".to_string())),
            fill_color: Some(Some("blue".to_string())),
            render_size: Some(Some(RenderSize { w: "1".to_string(), h: "2".to_string() })),
        };

        let format: Format = (&update).into();

        assert_eq!(format.align, Some(CellAlign::Center));
        assert_eq!(format.wrap, Some(CellWrap::Overflow));
        assert_eq!(format.numeric_format, Some(NumericFormat { kind: NumericFormatKind::Currency, symbol: None }));
        assert_eq!(format.numeric_decimals, Some(2));
        assert_eq!(format.numeric_commas, Some(true));
        assert_eq!(format.bold, Some(true));
        assert_eq!(format.italic, Some(true));
        assert_eq!(format.text_color, Some("red".to_string()));
        assert_eq!(format.fill_color, Some("blue".to_string()));
        assert_eq!(format.render_size, Some(RenderSize { w: "1".to_string(), h: "2".to_string()}));
    }
}