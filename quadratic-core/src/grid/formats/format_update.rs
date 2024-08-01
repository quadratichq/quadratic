//! This is used to update a format. Only the fields that are Some(_) will be updated.

use super::format::Format;
use crate::grid::{CellAlign, CellVerticalAlign, CellWrap, NumericFormat, RenderSize};
use serde::{Deserialize, Serialize};

/// Used to store changes from a Format to another Format.
#[derive(Deserialize, Serialize, Default, Debug, Clone, Eq, PartialEq)]
pub struct FormatUpdate {
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub align: Option<Option<CellAlign>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub vertical_align: Option<Option<CellVerticalAlign>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub wrap: Option<Option<CellWrap>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub numeric_format: Option<Option<NumericFormat>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub numeric_decimals: Option<Option<i16>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub numeric_commas: Option<Option<bool>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub bold: Option<Option<bool>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub italic: Option<Option<bool>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub text_color: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub fill_color: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub render_size: Option<Option<RenderSize>>,
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
    }

    pub fn fill_changed(&self) -> bool {
        self.fill_color.is_some()
    }

    /// Whether we need to resize row because of a wrap change.
    pub fn wrap_changed(&self) -> bool {
        self.wrap.is_some()
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
            render_size: self.render_size.clone().or(other.render_size.clone()),
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
            render_size: update.render_size.clone().unwrap_or(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grid::NumericFormatKind;
    use serial_test::parallel;

    #[test]
    #[parallel]
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
    #[parallel]
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
                render_size: Some(None)
            }
        );
    }

    #[test]
    #[parallel]
    fn html_changed() {
        let format = FormatUpdate {
            render_size: Some(Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            })),
            ..Default::default()
        };
        assert!(format.html_changed());

        let format = FormatUpdate {
            render_size: Some(None),
            ..Default::default()
        };
        assert!(format.html_changed());

        let format = FormatUpdate::default();
        assert!(!format.html_changed());
    }

    #[test]
    #[parallel]
    fn render_cells_changed() {
        let format = FormatUpdate {
            align: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

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
            numeric_commas: Some(None),
            ..Default::default()
        };
        assert!(format.render_cells_changed());

        let format = FormatUpdate {
            text_color: Some(None),
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
    #[parallel]
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
    #[parallel]
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
            render_size: Some(Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            })),
        };

        let format2 = FormatUpdate {
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
            render_size: Some(Some(RenderSize {
                w: "3".to_string(),
                h: "4".to_string(),
            })),
            ..Default::default()
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
        assert_eq!(
            combined.render_size,
            Some(Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string()
            }))
        );
    }

    #[test]
    #[parallel]
    fn clear_update() {
        let format = FormatUpdate {
            align: Some(Some(CellAlign::Center)),
            vertical_align: Some(Some(CellVerticalAlign::Middle)),
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
            render_size: Some(Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            })),
            ..Default::default()
        };

        let cleared = format.clear_update();

        assert_eq!(cleared.align, Some(None));
        assert_eq!(cleared.vertical_align, Some(None));
        assert_eq!(cleared.wrap, None);
        assert_eq!(cleared.numeric_format, Some(None));
        assert_eq!(cleared.numeric_decimals, Some(None));
        assert_eq!(cleared.numeric_commas, Some(None));
        assert_eq!(cleared.bold, Some(None));
        assert_eq!(cleared.italic, Some(None));
        assert_eq!(cleared.text_color, Some(None));
        assert_eq!(cleared.fill_color, Some(None));
        assert_eq!(cleared.render_size, Some(None));
    }

    #[test]
    #[parallel]
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
            render_size: Some(Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            })),
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
        assert_eq!(
            format.render_size,
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string()
            })
        );
    }

    #[test]
    #[parallel]
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
}
