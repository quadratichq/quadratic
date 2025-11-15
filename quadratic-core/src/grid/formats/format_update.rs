//! This is used to update a format. Only the fields that are Some(_) will be updated.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::format::Format;
use crate::grid::{CellAlign, CellVerticalAlign, CellWrap, NumericFormat, formatting::RenderSize};

/// Used to store changes from a Format to another Format.
#[derive(Deserialize, Serialize, Default, Debug, Clone, Eq, PartialEq, TS)]
pub struct FormatUpdate {
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<CellAlign>>")]
    pub align: Option<Option<CellAlign>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<CellVerticalAlign>>")]
    pub vertical_align: Option<Option<CellVerticalAlign>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<CellWrap>>")]
    pub wrap: Option<Option<CellWrap>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<NumericFormat>>")]
    pub numeric_format: Option<Option<NumericFormat>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<i16>>")]
    pub numeric_decimals: Option<Option<i16>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<bool>>")]
    pub numeric_commas: Option<Option<bool>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<bool>>")]
    pub bold: Option<Option<bool>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<bool>>")]
    pub italic: Option<Option<bool>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<String>>")]
    pub text_color: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<String>>")]
    pub fill_color: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<RenderSize>>")]
    pub render_size: Option<Option<RenderSize>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<String>>")]
    pub date_time: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<bool>>")]
    pub underline: Option<Option<bool>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<bool>>")]
    pub strike_through: Option<Option<bool>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[ts(as = "Option<Option<i16>>")]
    pub font_size: Option<Option<i16>>,
}

impl FormatUpdate {
    /// Returns a FormatUpdate with all fields set to Some(None). This is used
    /// to clear a format.
    pub fn cleared() -> Self {
        Self {
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
            font_size: Some(None),
        }
    }

    /// If the format update has any cleared fields (ie, Some(None)), then it
    /// returns a FormatUpdate only with those cleared fields.
    pub fn only_cleared(&self) -> Option<FormatUpdate> {
        let update = Self {
            align: self.align.filter(|a| a.is_none()),
            vertical_align: self.vertical_align.filter(|a| a.is_none()),
            wrap: self.wrap.filter(|a| a.is_none()),
            numeric_format: self.numeric_format.clone().filter(|a| a.is_none()),
            numeric_decimals: self.numeric_decimals.filter(|a| a.is_none()),
            numeric_commas: self.numeric_commas.filter(|a| a.is_none()),
            bold: self.bold.filter(|a| a.is_none()),
            italic: self.italic.filter(|a| a.is_none()),
            text_color: self.text_color.clone().filter(|a| a.is_none()),
            fill_color: self.fill_color.clone().filter(|a| a.is_none()),
            render_size: self.render_size.clone().filter(|a| a.is_none()),
            date_time: self.date_time.clone().filter(|a| a.is_none()),
            underline: self.underline.filter(|a| a.is_none()),
            strike_through: self.strike_through.filter(|a| a.is_none()),
            font_size: self.font_size.filter(|a| a.is_none()),
        };
        if update.is_default() {
            None
        } else {
            Some(update)
        }
    }

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
            && self.font_size.is_none()
    }

    /// Whether we need to send a client html update.
    pub fn html_changed(&self) -> bool {
        self.render_size.is_some()
    }

    /// Whether we need to send a render cell update.
    pub fn render_cells_changed(&self) -> bool {
        self.align.is_some()
            || self.vertical_align.is_some()
            || self.wrap.is_some()
            || self.numeric_format.is_some()
            || self.numeric_decimals.is_some()
            || self.numeric_commas.is_some()
            || self.bold.is_some()
            || self.italic.is_some()
            || self.text_color.is_some()
            || self.date_time.is_some()
            || self.underline.is_some()
            || self.strike_through.is_some()
            || self.font_size.is_some()
    }

    pub fn fill_changed(&self) -> bool {
        self.fill_color.is_some()
    }

    pub fn need_to_rewrap(&self) -> bool {
        self.numeric_format.is_some()
            || self.numeric_decimals.is_some()
            || self.numeric_commas.is_some()
            || self.bold.is_some()
            || self.italic.is_some()
            || self.date_time.is_some()
            || self.font_size.is_some()
    }

    pub fn combine(&self, other: &FormatUpdate) -> FormatUpdate {
        FormatUpdate {
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
            render_size: None,
            date_time: self.date_time.clone().or(other.date_time.clone()),
            underline: self.underline.or(other.underline),
            strike_through: self.strike_through.or(other.strike_through),
            font_size: self.font_size.or(other.font_size),
        }
    }

    /// Returns a FormatUpdate that will clear a given update
    pub fn clear_update(&self) -> FormatUpdate {
        let mut clear = FormatUpdate::default();
        if self.align.is_some() {
            clear.align = Some(None);
        }
        if self.vertical_align.is_some() {
            clear.vertical_align = Some(None);
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
        if self.date_time.is_some() {
            clear.date_time = Some(None);
        }
        if self.underline.is_some() {
            clear.underline = Some(None);
        }
        if self.strike_through.is_some() {
            clear.strike_through = Some(None);
        }
        if self.font_size.is_some() {
            clear.font_size = Some(None);
        }
        clear
    }
}

/// Converts a FormatUpdate to a Format.
impl From<&FormatUpdate> for Format {
    fn from(update: &FormatUpdate) -> Self {
        Self {
            align: update.align.unwrap_or(None),
            vertical_align: update.vertical_align.unwrap_or(None),
            wrap: update.wrap.unwrap_or(None),
            numeric_format: update.numeric_format.clone().unwrap_or(None),
            numeric_decimals: update.numeric_decimals.unwrap_or(None),
            numeric_commas: update.numeric_commas.unwrap_or(None),
            bold: update.bold.unwrap_or(None),
            italic: update.italic.unwrap_or(None),
            text_color: update.text_color.clone().unwrap_or(None),
            fill_color: update.fill_color.clone().unwrap_or(None),
            date_time: update.date_time.clone().unwrap_or(None),
            underline: update.underline.unwrap_or(None),
            strike_through: update.strike_through.unwrap_or(None),
            font_size: update.font_size.unwrap_or(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grid::NumericFormatKind;

    #[test]
    fn is_default() {
        let format = FormatUpdate::default();
        assert!(format.is_default());

        let format = FormatUpdate {
            bold: Some(None),
            ..Default::default()
        };
        assert!(!format.is_default());
    }

    #[test]
    fn cleared() {
        assert_eq!(
            FormatUpdate::cleared(),
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
                font_size: Some(None),
            }
        );
    }

    #[test]
    fn render_cells_changed() {
        let format = FormatUpdate {
            align: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            vertical_align: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            wrap: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            numeric_format: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            numeric_decimals: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            numeric_commas: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            bold: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            italic: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            text_color: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            underline: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            strike_through: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            fill_color: Some(None),
            ..Default::default()
        };
        assert!(!format.render_cells_changed());

        let format = FormatUpdate {
            render_size: Some(None),
            ..Default::default()
        };
        assert!(!format.render_cells_changed());

        let format = FormatUpdate::default();
        assert!(!format.render_cells_changed());
    }

    #[test]
    fn fill_changed() {
        let format = FormatUpdate {
            fill_color: Some(None),
            ..Default::default()
        };
        assert!(format.fill_changed());

        let format = FormatUpdate {
            fill_color: Some(None),
            ..Default::default()
        };
        assert!(format.fill_changed());

        let format = FormatUpdate {
            align: Some(None),
            ..Default::default()
        };
        assert!(!format.fill_changed());

        let format = FormatUpdate::default();
        assert!(!format.fill_changed());
    }

    #[test]
    fn combine() {
        let format1 = FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            vertical_align: Some(Some(CellVerticalAlign::Middle)),
            wrap: Some(Some(CellWrap::Overflow)),
            numeric_format: Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: None,
            })),
            numeric_decimals: Some(Some(2)),
            numeric_commas: Some(Some(true)),
            bold: Some(Some(true)),
            italic: Some(Some(true)),
            text_color: Some(Some("red".to_string())),
            fill_color: Some(Some("blue".to_string())),
            render_size: None,
            date_time: Some(Some("%H".to_string())),
            underline: Some(Some(true)),
            strike_through: Some(Some(true)),
            font_size: Some(Some(12)),
        };

        let format2 = FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            vertical_align: Some(Some(CellVerticalAlign::Middle)),
            wrap: Some(Some(CellWrap::Clip)),
            numeric_format: Some(Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            })),
            numeric_decimals: Some(Some(3)),
            numeric_commas: Some(Some(false)),
            bold: Some(Some(false)),
            italic: Some(Some(false)),
            text_color: Some(Some("blue".to_string())),
            fill_color: Some(Some("red".to_string())),
            render_size: None,
            date_time: Some(Some("%M".to_string())),
            underline: Some(Some(false)),
            strike_through: Some(Some(false)),
            font_size: Some(Some(14)),
        };

        let combined = format1.combine(&format2);

        assert_eq!(combined.align, Some(Some(CellAlign::Center)));
        assert_eq!(
            combined.vertical_align,
            Some(Some(CellVerticalAlign::Middle))
        );
        assert_eq!(combined.wrap, Some(Some(CellWrap::Overflow)));
        assert_eq!(
            combined.numeric_format,
            Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: None
            }))
        );
        assert_eq!(combined.numeric_decimals, Some(Some(2)));
        assert_eq!(combined.numeric_commas, Some(Some(true)));
        assert_eq!(combined.bold, Some(Some(true)));
        assert_eq!(combined.italic, Some(Some(true)));
        assert_eq!(combined.text_color, Some(Some("red".to_string())));
        assert_eq!(combined.fill_color, Some(Some("blue".to_string())));
        assert_eq!(combined.render_size, None);
        assert_eq!(combined.date_time, Some(Some("%H".to_string())));
        assert_eq!(combined.underline, Some(Some(true)));
        assert_eq!(combined.strike_through, Some(Some(true)));
        assert_eq!(combined.font_size, Some(Some(12)));
    }

    #[test]
    fn clear_update() {
        let format = FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            vertical_align: Some(Some(CellVerticalAlign::Middle)),
            wrap: Some(Some(CellWrap::Overflow)),
            numeric_format: Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: None,
            })),
            numeric_decimals: Some(Some(2)),
            numeric_commas: Some(Some(true)),
            bold: Some(Some(true)),
            italic: Some(Some(true)),
            text_color: Some(Some("red".to_string())),
            fill_color: Some(Some("blue".to_string())),
            render_size: None,
            date_time: Some(Some("%H".to_string())),
            underline: Some(Some(true)),
            strike_through: Some(Some(true)),
            font_size: Some(Some(12)),
        };

        let cleared = format.clear_update();

        assert_eq!(cleared.align, Some(None));
        assert_eq!(cleared.vertical_align, Some(None));
        assert_eq!(cleared.wrap, Some(None));
        assert_eq!(cleared.numeric_format, Some(None));
        assert_eq!(cleared.numeric_decimals, Some(None));
        assert_eq!(cleared.numeric_commas, Some(None));
        assert_eq!(cleared.bold, Some(None));
        assert_eq!(cleared.italic, Some(None));
        assert_eq!(cleared.text_color, Some(None));
        assert_eq!(cleared.fill_color, Some(None));
        assert_eq!(cleared.render_size, None);
        assert_eq!(cleared.date_time, Some(None));
        assert_eq!(cleared.underline, Some(None));
        assert_eq!(cleared.strike_through, Some(None));
        assert_eq!(cleared.font_size, Some(None));
    }

    #[test]
    fn format_update_to_format() {
        let update = FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            vertical_align: Some(Some(CellVerticalAlign::Middle)),
            wrap: Some(Some(CellWrap::Overflow)),
            numeric_format: Some(Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: None,
            })),
            numeric_decimals: Some(Some(2)),
            numeric_commas: Some(Some(true)),
            bold: Some(Some(true)),
            italic: Some(Some(true)),
            text_color: Some(Some("red".to_string())),
            fill_color: Some(Some("blue".to_string())),
            render_size: None,
            date_time: Some(Some("%H".to_string())),
            underline: Some(Some(true)),
            strike_through: Some(Some(true)),
            font_size: Some(Some(12)),
        };

        let format: Format = (&update).into();

        assert_eq!(format.align, Some(CellAlign::Center));
        assert_eq!(format.vertical_align, Some(CellVerticalAlign::Middle));
        assert_eq!(format.wrap, Some(CellWrap::Overflow));
        assert_eq!(
            format.numeric_format,
            Some(NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: None
            })
        );
        assert_eq!(format.numeric_decimals, Some(2));
        assert_eq!(format.numeric_commas, Some(true));
        assert_eq!(format.bold, Some(true));
        assert_eq!(format.italic, Some(true));
        assert_eq!(format.text_color, Some("red".to_string()));
        assert_eq!(format.fill_color, Some("blue".to_string()));
        assert_eq!(format.date_time, Some("%H".to_string()));
        assert_eq!(format.underline, Some(true));
        assert_eq!(format.strike_through, Some(true));
        assert_eq!(format.font_size, Some(12));
    }

    #[test]
    fn serialize_format_update() {
        let update = FormatUpdate {
            align: Some(None),
            ..Default::default()
        };
        let serialized = serde_json::to_string(&update).unwrap();
        assert_eq!(serialized, r#"{"align":null}"#);

        let update_deserialized = serde_json::from_str::<FormatUpdate>(&serialized).unwrap();
        assert_eq!(update_deserialized.align, Some(None));
        assert_eq!(update_deserialized.wrap, None);
    }

    #[test]
    fn test_only_clear() {
        let update = FormatUpdate::default();
        assert_eq!(update.only_cleared(), None);

        let update = FormatUpdate {
            align: Some(None),
            bold: Some(Some(true)),
            ..Default::default()
        };
        assert_eq!(
            update.only_cleared(),
            Some(FormatUpdate {
                align: Some(None),
                ..Default::default()
            })
        );
    }
}
