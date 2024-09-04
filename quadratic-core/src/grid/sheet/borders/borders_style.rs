use std::collections::HashMap;

#[cfg(feature = "js")]
use crate::color::Rgba;
use crate::{small_timestamp::SmallTimestamp, RunLengthEncoding};
use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[serde(rename_all = "lowercase")]
pub enum BorderSelection {
    All,
    Inner,
    Outer,
    Horizontal,
    Vertical,
    Left,
    Top,
    Right,
    Bottom,
    Clear,
}

#[derive(
    Default,
    Serialize,
    Deserialize,
    Debug,
    Copy,
    Clone,
    PartialEq,
    Eq,
    Hash,
    PartialOrd,
    Ord,
    Display,
    EnumString,
    TS,
)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum CellBorderLine {
    #[default]
    Line1,
    Line2,
    Line3,
    Dotted,
    Dashed,
    Double,
}

impl CellBorderLine {
    pub fn as_css_string(&self) -> &'static str {
        match self {
            CellBorderLine::Line1 => "1px solid",
            CellBorderLine::Line2 => "2px solid",
            CellBorderLine::Line3 => "3px solid",
            CellBorderLine::Dotted => "1px dashed",
            CellBorderLine::Dashed => "1px dotted",
            CellBorderLine::Double => "3px double",
        }
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
pub struct BorderStyle {
    pub color: Rgba,
    pub line: CellBorderLine,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, TS)]
pub struct BorderStyleTimestamp {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub timestamp: SmallTimestamp,
}

impl BorderStyleTimestamp {
    pub fn new(color: Rgba, line: CellBorderLine) -> Self {
        BorderStyleTimestamp {
            color,
            line,
            timestamp: SmallTimestamp::now(),
        }
    }

    #[cfg(test)]
    pub fn is_equal_ignore_timestamp(
        b1: Option<BorderStyleTimestamp>,
        b2: Option<BorderStyleTimestamp>,
    ) -> bool {
        match (b1, b2) {
            (None, None) => true,
            (Some(b1), Some(b2)) => b1.color == b2.color && b1.line == b2.line,
            _ => false,
        }
    }
}

impl From<BorderStyle> for BorderStyleTimestamp {
    fn from(border_style: BorderStyle) -> Self {
        BorderStyleTimestamp {
            color: border_style.color,
            line: border_style.line,
            timestamp: SmallTimestamp::now(),
        }
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, TS)]
pub struct BorderStyleCell {
    pub top: Option<BorderStyleTimestamp>,
    pub bottom: Option<BorderStyleTimestamp>,
    pub left: Option<BorderStyleTimestamp>,
    pub right: Option<BorderStyleTimestamp>,
}

impl From<BorderStyleCell> for BorderStyleCellUpdate {
    fn from(cell: BorderStyleCell) -> Self {
        BorderStyleCellUpdate {
            top: cell.top.map(|ts| ts.into()),
            bottom: cell.bottom.map(|ts| ts.into()),
            left: cell.left.map(|ts| ts.into()),
            right: cell.right.map(|ts| ts.into()),
        }
    }
}

impl BorderStyleCell {
    /// Overrides the border style of the cell with the new border style or
    /// clears the border if the new border style is None.
    pub fn override_border(&self) -> BorderStyleCellUpdate {
        BorderStyleCellUpdate {
            top: self.top.map(Some).or(Some(None)),
            bottom: self.bottom.map(Some).or(Some(None)),
            left: self.left.map(Some).or(Some(None)),
            right: self.right.map(Some).or(Some(None)),
        }
    }

    pub fn clear() -> BorderStyleCellUpdate {
        BorderStyleCellUpdate {
            top: Some(None),
            bottom: Some(None),
            left: Some(None),
            right: Some(None),
        }
    }

    #[cfg(test)]
    pub fn all() -> BorderStyleCell {
        BorderStyleCell {
            top: Some(BorderStyleTimestamp::default()),
            bottom: Some(BorderStyleTimestamp::default()),
            left: Some(BorderStyleTimestamp::default()),
            right: Some(BorderStyleTimestamp::default()),
        }
    }
}

impl BorderStyleCell {
    /// Apply an update to the cell.
    /// Returns the original cell so it can be used for undo.
    pub fn apply_update(&mut self, update: &BorderStyleCellUpdate) -> BorderStyleCellUpdate {
        let original = (*self).into();
        if let Some(top) = update.top {
            self.top = top;
        }
        if let Some(bottom) = update.bottom {
            self.bottom = bottom;
        }
        if let Some(left) = update.left {
            self.left = left;
        }
        if let Some(right) = update.right {
            self.right = right;
        }
        original
    }

    #[cfg(test)]
    pub fn is_equal_ignore_timestamp(
        b1: Option<BorderStyleCell>,
        b2: Option<BorderStyleCell>,
    ) -> bool {
        match (b1, b2) {
            (None, None) => true,
            (Some(b1), Some(b2)) => {
                BorderStyleTimestamp::is_equal_ignore_timestamp(b1.top, b2.top)
                    && BorderStyleTimestamp::is_equal_ignore_timestamp(b1.bottom, b2.bottom)
                    && BorderStyleTimestamp::is_equal_ignore_timestamp(b1.left, b2.left)
                    && BorderStyleTimestamp::is_equal_ignore_timestamp(b1.right, b2.right)
            }
            _ => false,
        }
    }
}

pub type BorderStyleCellUpdates = RunLengthEncoding<BorderStyleCellUpdate>;

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub struct BorderStyleCellUpdate {
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub top: Option<Option<BorderStyleTimestamp>>,

    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub bottom: Option<Option<BorderStyleTimestamp>>,

    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub left: Option<Option<BorderStyleTimestamp>>,

    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub right: Option<Option<BorderStyleTimestamp>>,
}

impl BorderStyleCellUpdate {
    pub fn clear() -> Self {
        BorderStyleCellUpdate {
            top: Some(None),
            bottom: Some(None),
            left: Some(None),
            right: Some(None),
        }
    }

    /// Create a cell with a complete border on all sides.
    #[cfg(test)]
    pub fn all() -> Self {
        BorderStyleCellUpdate {
            top: Some(Some(BorderStyleTimestamp::default())),
            bottom: Some(Some(BorderStyleTimestamp::default())),
            left: Some(Some(BorderStyleTimestamp::default())),
            right: Some(Some(BorderStyleTimestamp::default())),
        }
    }

    #[cfg(test)]
    pub fn erase() -> Self {
        BorderStyleCellUpdate {
            top: Some(None),
            bottom: Some(None),
            left: Some(None),
            right: Some(None),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, TS)]
pub struct JsBorderHorizontal {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub x: i64,
    pub y: i64,
    pub width: i64,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, TS)]
pub struct JsBorderVertical {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub x: i64,
    pub y: i64,
    pub height: i64,
}

#[derive(Default, Serialize, Deserialize, Debug, PartialEq, Eq, TS)]
pub struct JsBorders {
    pub hash_x: i64,
    pub hash_y: i64,
    pub horizontal: Vec<JsBorderHorizontal>,
    pub vertical: Vec<JsBorderVertical>,
}

impl JsBorders {
    pub fn is_empty(&self) -> bool {
        self.horizontal.is_empty() && self.vertical.is_empty()
    }
}

#[derive(Default, Serialize, Deserialize, Debug, TS)]
pub struct JsBordersSheet {
    pub all: BorderStyleCell,
    pub columns: HashMap<i64, BorderStyleCell>,
    pub rows: HashMap<i64, BorderStyleCell>,

    // if None is sent, then ignore cells (used when sheet borders changed--we don't need to send all cells again)
    pub hashes: Option<Vec<JsBorders>>,
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn apply_update() {
        let mut cell = BorderStyleCell::default();
        let update = BorderStyleCellUpdate::all();
        let original = cell.apply_update(&update);
        assert_eq!(cell, BorderStyleCell::all());
        assert_eq!(original, BorderStyleCellUpdate::clear());
    }

    #[test]
    #[parallel]
    fn override_border() {
        let update = BorderStyleCell {
            top: Some(BorderStyleTimestamp::new(
                Rgba::default(),
                CellBorderLine::Line2,
            )),
            bottom: None,
            left: None,
            right: Some(BorderStyleTimestamp::default()),
        };
        let updated = update.override_border();
        assert_eq!(updated.top.unwrap().unwrap().line, CellBorderLine::Line2);
        assert_eq!(updated.bottom, Some(None));
        assert_eq!(updated.left, Some(None));
        assert_eq!(updated.right.unwrap().unwrap().line, CellBorderLine::Line1);
    }

    #[test]
    #[parallel]
    fn clear() {
        let cleared = BorderStyleCell::clear();
        assert_eq!(cleared.top, Some(None));
        assert_eq!(cleared.bottom, Some(None));
        assert_eq!(cleared.left, Some(None));
        assert_eq!(cleared.right, Some(None));
    }

    #[test]
    #[parallel]
    fn timestamp_is_equal_ignore_timestamp() {
        assert!(BorderStyleTimestamp::is_equal_ignore_timestamp(
            Some(BorderStyleTimestamp::default()),
            Some(BorderStyleTimestamp {
                timestamp: SmallTimestamp::new(0),
                ..BorderStyleTimestamp::default()
            }),
        ));
        assert!(!BorderStyleTimestamp::is_equal_ignore_timestamp(
            Some(BorderStyleTimestamp::default()),
            Some(BorderStyleTimestamp::new(
                Rgba::default(),
                CellBorderLine::Line2
            )),
        ));
    }

    #[test]
    #[parallel]
    fn cell_is_equal_ignore_timestamp() {
        let b1 = Some(BorderStyleCell::all());
        let b2 = Some(BorderStyleCell {
            top: Some(BorderStyleTimestamp {
                timestamp: SmallTimestamp::new(1),
                ..BorderStyleTimestamp::default()
            }),
            bottom: Some(BorderStyleTimestamp {
                timestamp: SmallTimestamp::new(1),
                ..BorderStyleTimestamp::default()
            }),
            left: Some(BorderStyleTimestamp {
                timestamp: SmallTimestamp::new(1),
                ..BorderStyleTimestamp::default()
            }),
            right: Some(BorderStyleTimestamp {
                timestamp: SmallTimestamp::new(1),
                ..BorderStyleTimestamp::default()
            }),
        });
        assert!(BorderStyleCell::is_equal_ignore_timestamp(b1, b2));

        let b1 = Some(BorderStyleCell {
            top: Some(BorderStyleTimestamp::new(
                Rgba::default(),
                CellBorderLine::Line1,
            )),
            ..BorderStyleCell::default()
        });
        let b2 = Some(BorderStyleCell {
            top: Some(BorderStyleTimestamp::new(
                Rgba::default(),
                CellBorderLine::Line2,
            )),
            ..BorderStyleCell::default()
        });
        assert!(!BorderStyleCell::is_equal_ignore_timestamp(b1, b2));
    }
}
