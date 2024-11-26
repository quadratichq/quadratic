//! This stores a format for Operations and eventually for the entire sheet.

use std::fmt::Display;

use serde::{Deserialize, Serialize};

use super::format_update::FormatUpdate;
use crate::grid::{CellAlign, CellVerticalAlign, CellWrap, NumericFormat, RenderSize};

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
    pub render_size: Option<RenderSize>,
    pub date_time: Option<String>,
    pub underline: Option<bool>,
    pub strike_through: Option<bool>,
}

impl Format {
    pub fn is_default(&self) -> bool {
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
            && self.render_size.is_none()
            && self.date_time.is_none()
            && self.underline.is_none()
            && self.strike_through.is_none()
    }

    /// Clears all formatting.
    pub fn clear(&mut self) {
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
        self.render_size = None;
        self.date_time = None;
        self.underline = None;
        self.strike_through = None;
    }

    /// Applies a [`FormatUpdate`] and returns a [`FormatUpdate`] to undo the
    /// change.
    pub fn apply_update(&mut self, update: &FormatUpdate) -> FormatUpdate {
        fn replace_opt<T: Clone>(opt: &mut T, update: &Option<T>) -> Option<T> {
            update
                .as_ref()
                .map(|new_value| std::mem::replace(opt, new_value.clone()))
        }

        FormatUpdate {
            align: replace_opt(&mut self.align, &update.align),
            vertical_align: replace_opt(&mut self.vertical_align, &update.vertical_align),
            wrap: replace_opt(&mut self.wrap, &update.wrap),
            numeric_format: replace_opt(&mut self.numeric_format, &update.numeric_format),
            numeric_decimals: replace_opt(&mut self.numeric_decimals, &update.numeric_decimals),
            numeric_commas: replace_opt(&mut self.numeric_commas, &update.numeric_commas),
            bold: replace_opt(&mut self.bold, &update.bold),
            italic: replace_opt(&mut self.italic, &update.italic),
            text_color: replace_opt(&mut self.text_color, &update.text_color),
            fill_color: replace_opt(&mut self.fill_color, &update.fill_color),
            render_size: replace_opt(&mut self.render_size, &update.render_size),
            date_time: replace_opt(&mut self.date_time, &update.date_time),
            underline: replace_opt(&mut self.underline, &update.underline),
            strike_through: replace_opt(&mut self.strike_through, &update.strike_through),
        }
    }

    /// Applies a [`FormatUpdate`] and returns a [`FormatUpdate`] to undo the
    /// change.
    ///
    /// Returns `None` for the new format if it is default. Returns `None` for
    /// the update if it is empty.
    #[must_use]
    pub fn apply_update_opt(
        &self,
        update: &FormatUpdate,
    ) -> (Option<Format>, Option<FormatUpdate>) {
        let mut ret = self.clone();
        let reverse_update = ret.apply_update(update);
        (
            (!ret.is_default()).then_some(ret),
            (!reverse_update.is_default()).then_some(reverse_update),
        )
    }

    /// Returns a FormatUpdate only if the current format needs to be cleared.
    /// This does not change the self's format.
    ///
    /// This is used to clear formats for format changes in columns, rows, and
    /// sheets. For example, if you set bold in a column, all cells with bold in
    /// that column will remove their bold setting so that the column's format
    /// takes precedence.
    pub fn needs_to_clear_cell_format_for_parent(
        &self,
        update: &FormatUpdate,
    ) -> Option<FormatUpdate> {
        let mut old = FormatUpdate::default();
        if self.align.is_some() && update.align.is_some() {
            old.align = Some(None);
        }
        if self.vertical_align.is_some() && update.vertical_align.is_some() {
            old.vertical_align = Some(None);
        }
        if self.wrap.is_some() && update.wrap.is_some() {
            old.wrap = Some(None);
        }
        if self.numeric_format.is_some() && update.numeric_format.is_some() {
            old.numeric_format = Some(None);
        }
        if self.numeric_decimals.is_some() && update.numeric_decimals.is_some() {
            old.numeric_decimals = Some(None);
        }
        if self.numeric_commas.is_some() && update.numeric_commas.is_some() {
            old.numeric_commas = Some(None);
        }
        if self.bold.is_some() && update.bold.is_some() {
            old.bold = Some(None);
        }
        if self.italic.is_some() && update.italic.is_some() {
            old.italic = Some(None);
        }
        if self.text_color.is_some() && update.text_color.is_some() {
            old.text_color = Some(None);
        }
        if self.fill_color.is_some() && update.fill_color.is_some() {
            old.fill_color = Some(None);
        }
        if self.render_size.is_some() && update.render_size.is_some() {
            old.render_size = Some(None);
        }
        if self.date_time.is_some() && update.date_time.is_some() {
            old.date_time = Some(None);
        }
        if self.underline.is_some() && update.underline.is_some() {
            old.underline = Some(None);
        }
        if self.strike_through.is_some() && update.strike_through.is_some() {
            old.strike_through = Some(None);
        }
        if old.is_default() {
            None
        } else {
            Some(old)
        }
    }

    /// Turns a Format into a FormatUpdate, with None set to Some(None) to
    /// replace the entire value.
    pub fn to_replace(&self) -> FormatUpdate {
        FormatUpdate {
            align: Some(self.align),
            vertical_align: Some(self.vertical_align),
            wrap: Some(self.wrap),
            numeric_format: Some(self.numeric_format.clone()),
            numeric_decimals: Some(self.numeric_decimals),
            numeric_commas: Some(self.numeric_commas),
            bold: Some(self.bold),
            italic: Some(self.italic),
            text_color: Some(self.text_color.clone()),
            fill_color: Some(self.fill_color.clone()),
            render_size: Some(self.render_size.clone()),
            date_time: Some(self.date_time.clone()),
            underline: Some(self.underline),
            strike_through: Some(self.strike_through),
        }
    }
}

impl Display for Format {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut s = String::new();
        if let Some(align) = self.align {
            s.push_str(&format!("align: {:?}, ", align));
        }
        if let Some(wrap) = self.wrap {
            s.push_str(&format!("wrap: {:?}, ", wrap));
        }
        if let Some(numeric_format) = &self.numeric_format {
            s.push_str(&format!("numeric_format: {:?}, ", numeric_format));
        }
        if let Some(numeric_decimals) = self.numeric_decimals {
            s.push_str(&format!("numeric_decimals: {:?}, ", numeric_decimals));
        }
        if let Some(numeric_commas) = self.numeric_commas {
            s.push_str(&format!("numeric_commas: {:?}, ", numeric_commas));
        }
        if let Some(bold) = self.bold {
            s.push_str(&format!("bold: {:?}, ", bold));
        }
        if let Some(italic) = self.italic {
            s.push_str(&format!("italic: {:?}, ", italic));
        }
        if let Some(text_color) = &self.text_color {
            s.push_str(&format!("text_color: {:?}, ", text_color));
        }
        if let Some(fill_color) = &self.fill_color {
            s.push_str(&format!("fill_color: {:?}, ", fill_color));
        }
        if let Some(render_size) = &self.render_size {
            s.push_str(&format!("render_size: {:?}, ", render_size));
        }
        if let Some(date_time) = &self.date_time {
            s.push_str(&format!("date_time: {:?}, ", date_time));
        }
        if let Some(underline) = self.underline {
            s.push_str(&format!("underline: {:?}, ", underline));
        }
        if let Some(strike_through) = self.strike_through {
            s.push_str(&format!("strike_through: {:?}, ", strike_through));
        }
        write!(f, "{}", s)
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
            render_size: format.render_size.clone().map(Some),
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
            render_size: format.render_size.clone().map(Some),
            date_time: format.date_time.clone().map(Some),
            underline: format.underline.map(Some),
            strike_through: format.strike_through.map(Some),
        }
    }
}

#[cfg(test)]
mod test {
    use serial_test::parallel;

    use super::*;
    use crate::grid::{CellAlign, CellWrap, NumericFormat, NumericFormatKind, RenderSize};

    #[test]
    #[parallel]
    fn is_default() {
        let format = Format::default();
        assert!(format.is_default());
    }

    #[test]
    #[parallel]
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
            render_size: Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
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
        assert_eq!(format.render_size, None);
        assert_eq!(format.date_time, None);
        assert_eq!(format.underline, None);
        assert_eq!(format.strike_through, None);
    }

    #[test]
    #[parallel]
    fn needs_to_clear_cell_format_for_parent() {
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
            render_size: Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
            date_time: Some("%H".to_string()),
            underline: Some(true),
            strike_through: Some(true),
        };

        let update = FormatUpdate {
            align: Some(Some(CellAlign::Left)),
            vertical_align: Some(Some(CellVerticalAlign::Top)),
            wrap: Some(Some(CellWrap::Overflow)),
            numeric_format: Some(Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: Some("%".to_string()),
            })),
            numeric_decimals: Some(Some(3)),
            numeric_commas: Some(Some(false)),
            bold: Some(Some(false)),
            italic: Some(Some(false)),
            text_color: Some(Some("blue".to_string())),
            fill_color: Some(Some("red".to_string())),
            render_size: Some(Some(RenderSize {
                w: "3".to_string(),
                h: "4".to_string(),
            })),
            date_time: Some(Some("%M".to_string())),
            underline: Some(Some(true)),
            strike_through: Some(Some(true)),
        };

        let clear_update = format
            .needs_to_clear_cell_format_for_parent(&update)
            .unwrap();
        assert_eq!(
            clear_update,
            FormatUpdate {
                align: Some(None),
                vertical_align: Some(None),
                wrap: Some(None),
                numeric_format: Some(None),
                numeric_decimals: Some(None),
                numeric_commas: Some(None),
                bold: Some(None),
                italic: Some(None),
                text_color: Some(None),
                fill_color: Some(None),
                render_size: Some(None),
                date_time: Some(None),
                underline: Some(None),
                strike_through: Some(None),
            }
        );
    }

    #[test]
    #[parallel]
    fn test_apply_update() {
        let mut format = Format::default();
        let update = FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            vertical_align: Some(Some(CellVerticalAlign::Middle)),
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
            date_time: Some(Some("%H".to_string())),
            underline: Some(Some(true)),
            strike_through: Some(Some(true)),
        };

        let old = format.apply_update(&update);

        assert_eq!(format.align, Some(CellAlign::Center));
        assert_eq!(format.vertical_align, Some(CellVerticalAlign::Middle));
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
        assert_eq!(format.date_time, Some("%H".to_string()));
        assert_eq!(format.underline, Some(true));
        assert_eq!(format.strike_through, Some(true));

        let undo = format.apply_update(&old);
        assert!(format.is_default());
        assert_eq!(undo, update);
    }

    #[test]
    #[parallel]
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
            render_size: Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
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
        assert_eq!(
            update.render_size,
            Some(Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string()
            }))
        );
        assert_eq!(update.date_time, Some(Some("%H".to_string())));
        assert_eq!(update.underline, Some(Some(true)));
        assert_eq!(update.strike_through, Some(Some(true)));
    }

    #[test]
    #[parallel]
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
            render_size: Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
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
        assert_eq!(
            update.render_size,
            Some(Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string()
            }))
        );
        assert_eq!(update.date_time, Some(Some("%H".to_string())));
        assert_eq!(update.underline, Some(Some(true)));
        assert_eq!(update.strike_through, Some(Some(true)));
    }

    #[test]
    #[parallel]
    fn to_replace() {
        let format_update: FormatUpdate = Format::default().to_replace();
        assert_eq!(
            format_update,
            FormatUpdate {
                align: Some(None),
                vertical_align: Some(None),
                wrap: Some(None),
                numeric_format: Some(None),
                numeric_decimals: Some(None),
                numeric_commas: Some(None),
                bold: Some(None),
                italic: Some(None),
                text_color: Some(None),
                fill_color: Some(None),
                render_size: Some(None),
                date_time: Some(None),
                underline: Some(None),
                strike_through: Some(None),
            }
        );
    }
}
