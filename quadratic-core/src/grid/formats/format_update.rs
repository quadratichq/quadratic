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
}

impl FormatUpdate {
    /// Returns a FormatUpdate with all fields set to Some(None). This is used
    /// to clear a format.
    pub(crate) fn cleared() -> Self {
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
        }
    }

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
            && self.render_size.is_none()
            && self.date_time.is_none()
            && self.underline.is_none()
            && self.strike_through.is_none()
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
            }
        );
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
}
