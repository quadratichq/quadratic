//! Data structures for borders.

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

    // this is needed to ensure that the border is cleared when compared to
    // neighbors or all, columns, rows
    Clear,
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
            CellBorderLine::Clear => "0px solid",
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum BorderSide {
    Top,
    Bottom,
    Left,
    Right,
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

    pub fn clear() -> Self {
        BorderStyleTimestamp {
            color: Rgba::default(),
            line: CellBorderLine::Clear,
            timestamp: SmallTimestamp::now(),
        }
    }

    /// If the style is clear, then returns None, otherwise returns the style.
    pub fn remove_clear(style: Option<BorderStyleTimestamp>) -> Option<BorderStyleTimestamp> {
        style.filter(|&style| style.line != CellBorderLine::Clear)
    }

    /// Returns whether the style is the same by ignoring the timestamp.
    pub fn is_equal_to_border_style(&self, other: &BorderStyle) -> bool {
        self.color == other.color && self.line == other.line
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

impl From<BorderStyleTimestamp> for BorderStyle {
    fn from(border_style: BorderStyleTimestamp) -> Self {
        BorderStyle {
            color: border_style.color,
            line: border_style.line,
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
    /// clears the border if the new border style is None. If force_clear is
    /// true, then the border is set to BorderLineStyle::Clear, otherwise the
    /// border is set to Some(None) (ie, removed).
    pub fn override_border(&self, force_clear: bool) -> BorderStyleCellUpdate {
        let clear = if force_clear {
            Some(Some(BorderStyleTimestamp::clear()))
        } else {
            Some(None)
        };
        BorderStyleCellUpdate {
            top: self.top.map(Some).or(clear),
            bottom: self.bottom.map(Some).or(clear),
            left: self.left.map(Some).or(clear),
            right: self.right.map(Some).or(clear),
        }
    }

    pub fn clear() -> BorderStyleCellUpdate {
        BorderStyleCellUpdate {
            top: Some(Some(BorderStyleTimestamp::clear())),
            bottom: Some(Some(BorderStyleTimestamp::clear())),
            left: Some(Some(BorderStyleTimestamp::clear())),
            right: Some(Some(BorderStyleTimestamp::clear())),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.top.is_none() && self.bottom.is_none() && self.left.is_none() && self.right.is_none()
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
    ///
    /// Returns the original cell so it can be used for undo.
    pub fn apply_update(&mut self, update: &BorderStyleCellUpdate) -> BorderStyleCellUpdate {
        let mut undo = BorderStyleCellUpdate::default();
        if let Some(top) = update.top {
            undo.top = self.top.map_or(Some(None), |ts| Some(ts.into()));
            self.top = top;
        }
        if let Some(bottom) = update.bottom {
            undo.bottom = self.bottom.map_or(Some(None), |ts| Some(ts.into()));
            self.bottom = bottom;
        }
        if let Some(left) = update.left {
            undo.left = self.left.map_or(Some(None), |ts| Some(ts.into()));
            self.left = left;
        }
        if let Some(right) = update.right {
            undo.right = self.right.map_or(Some(None), |ts| Some(ts.into()));
            self.right = right;
        }
        undo
    }

    /// Used to test equality for unit tests by ignoring the timestamp.
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
    /// Converts the update to a clear update (ie, if a border value is set,
    /// then turns it into Some(None); otherwise None).
    pub fn convert_to_clear(&self) -> BorderStyleCellUpdate {
        BorderStyleCellUpdate {
            top: if self.top.is_some() { Some(None) } else { None },
            bottom: if self.bottom.is_some() {
                Some(None)
            } else {
                None
            },
            left: if self.left.is_some() {
                Some(None)
            } else {
                None
            },
            right: if self.right.is_some() {
                Some(None)
            } else {
                None
            },
        }
    }

    /// Create a update that will clear the border. If force_clear is true, then
    /// the border is set to BorderLineStyle::Clear, otherwise the border is set
    /// to None (ie, removed).
    pub fn clear(force_clear: bool) -> Self {
        if force_clear {
            BorderStyleCellUpdate {
                top: Some(Some(BorderStyleTimestamp::clear())),
                bottom: Some(Some(BorderStyleTimestamp::clear())),
                left: Some(Some(BorderStyleTimestamp::clear())),
                right: Some(Some(BorderStyleTimestamp::clear())),
            }
        } else {
            BorderStyleCellUpdate {
                top: Some(None),
                bottom: Some(None),
                left: Some(None),
                right: Some(None),
            }
        }
    }

    /// Converts all line == Clear to None in a BorderStyleCellUpdate.
    pub fn replace_clear_with_none(&self) -> BorderStyleCellUpdate {
        BorderStyleCellUpdate {
            top: self.top.map(|border| {
                border.and_then(|b| {
                    if b.line == CellBorderLine::Clear {
                        None
                    } else {
                        Some(b)
                    }
                })
            }),
            bottom: self.bottom.map(|border| {
                border.and_then(|b| {
                    if b.line == CellBorderLine::Clear {
                        None
                    } else {
                        Some(b)
                    }
                })
            }),
            left: self.left.map(|border| {
                border.and_then(|b| {
                    if b.line == CellBorderLine::Clear {
                        None
                    } else {
                        Some(b)
                    }
                })
            }),
            right: self.right.map(|border| {
                border.and_then(|b| {
                    if b.line == CellBorderLine::Clear {
                        None
                    } else {
                        Some(b)
                    }
                })
            }),
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

    /// Used to test equality for unit tests by ignoring the timestamps.
    #[cfg(test)]
    pub fn is_equal_ignore_timestamp(
        b1: Option<BorderStyleCellUpdate>,
        b2: Option<BorderStyleCellUpdate>,
    ) -> bool {
        match (b1, b2) {
            (None, None) => true,
            (Some(b1), Some(b2)) => {
                BorderStyleTimestamp::is_equal_ignore_timestamp(b1.top.flatten(), b2.top.flatten())
                    && BorderStyleTimestamp::is_equal_ignore_timestamp(
                        b1.bottom.flatten(),
                        b2.bottom.flatten(),
                    )
                    && BorderStyleTimestamp::is_equal_ignore_timestamp(
                        b1.left.flatten(),
                        b2.left.flatten(),
                    )
                    && BorderStyleTimestamp::is_equal_ignore_timestamp(
                        b1.right.flatten(),
                        b2.right.flatten(),
                    )
            }
            _ => false,
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

impl JsBorderHorizontal {
    #[cfg(test)]
    pub fn new_test(x: i64, y: i64, width: i64) -> Self {
        JsBorderHorizontal {
            color: Rgba::default(),
            line: CellBorderLine::Line1,
            x,
            y,
            width,
        }
    }
}
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, TS)]
pub struct JsBorderVertical {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub x: i64,
    pub y: i64,
    pub height: i64,
}

impl JsBorderVertical {
    #[cfg(test)]
    pub fn new_test(x: i64, y: i64, height: i64) -> Self {
        JsBorderVertical {
            color: Rgba::default(),
            line: CellBorderLine::Line1,
            x,
            y,
            height,
        }
    }
}

#[derive(Default, Serialize, Deserialize, Debug, PartialEq, Eq, TS)]
pub struct JsBordersSheet {
    pub all: Option<BorderStyleCell>,

    // regrettably, we need to use String instead of i64 since js can't handle a
    // Record<BigInt, ...>
    pub columns: Option<HashMap<String, BorderStyleCell>>,
    pub rows: Option<HashMap<String, BorderStyleCell>>,

    pub horizontal: Option<Vec<JsBorderHorizontal>>,
    pub vertical: Option<Vec<JsBorderVertical>>,
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
        assert!(BorderStyleCellUpdate::is_equal_ignore_timestamp(
            Some(original),
            Some(BorderStyleCellUpdate::clear(false))
        ));
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
        let updated = update.override_border(false);
        assert_eq!(updated.top.unwrap().unwrap().line, CellBorderLine::Line2);
        assert_eq!(updated.bottom, Some(None));
        assert_eq!(updated.left, Some(None));
        assert_eq!(updated.right.unwrap().unwrap().line, CellBorderLine::Line1);

        let updated = update.override_border(true);
        assert_eq!(updated.top.unwrap().unwrap().line, CellBorderLine::Line2);
        assert_eq!(updated.bottom, Some(Some(BorderStyleTimestamp::clear())));
        assert_eq!(updated.left, Some(Some(BorderStyleTimestamp::clear())));
        assert_eq!(updated.right.unwrap().unwrap().line, CellBorderLine::Line1);
    }

    #[test]
    #[parallel]
    fn clear() {
        let cleared = BorderStyleCell::clear();
        assert_eq!(cleared.top, Some(Some(BorderStyleTimestamp::clear())));
        assert_eq!(cleared.bottom, Some(Some(BorderStyleTimestamp::clear())));
        assert_eq!(cleared.left, Some(Some(BorderStyleTimestamp::clear())));
        assert_eq!(cleared.right, Some(Some(BorderStyleTimestamp::clear())));
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

    #[test]
    #[parallel]
    fn remove_clear() {
        assert_eq!(
            BorderStyleTimestamp::remove_clear(Some(BorderStyleTimestamp::clear())),
            None
        );
        assert_eq!(
            BorderStyleTimestamp::remove_clear(Some(BorderStyleTimestamp::default())),
            Some(BorderStyleTimestamp::default())
        );
    }

    #[test]
    #[parallel]
    fn is_empty() {
        let cell = BorderStyleCell::default();
        assert!(cell.is_empty());

        let cell = BorderStyleCell {
            top: Some(BorderStyleTimestamp::default()),
            ..BorderStyleCell::default()
        };
        assert!(!cell.is_empty());
    }

    #[test]
    #[parallel]
    fn js_border_horizontal_new() {
        let border = JsBorderHorizontal::new_test(1, 1, 1);
        assert_eq!(border.x, 1);
        assert_eq!(border.y, 1);
        assert_eq!(border.width, 1);
    }

    #[test]
    #[parallel]
    fn js_border_vertical_new() {
        let border = JsBorderVertical::new_test(1, 1, 1);
        assert_eq!(border.x, 1);
        assert_eq!(border.y, 1);
        assert_eq!(border.height, 1);
    }

    #[test]
    #[parallel]
    fn convert_to_clear() {
        let update = BorderStyleCellUpdate {
            top: Some(Some(BorderStyleTimestamp::default())),
            bottom: Some(Some(BorderStyleTimestamp::default())),
            left: None,
            right: Some(Some(BorderStyleTimestamp::default())),
        };
        let clear = update.convert_to_clear();
        assert_eq!(clear.top, Some(None));
        assert_eq!(clear.bottom, Some(None));
        assert_eq!(clear.left, None);
        assert_eq!(clear.right, Some(None));
    }

    #[test]
    #[parallel]
    fn replace_clear_with_none() {
        let update = BorderStyleCellUpdate {
            top: Some(Some(BorderStyleTimestamp::default())),
            bottom: Some(Some(BorderStyleTimestamp::clear())),
            left: Some(Some(BorderStyleTimestamp::default())),
            right: Some(Some(BorderStyleTimestamp::default())),
        };
        let updated = update.replace_clear_with_none();
        assert!(updated.top.unwrap().is_some());
        assert!(updated.bottom.unwrap().is_none());
        assert!(updated.left.unwrap().is_some());
        assert!(updated.right.unwrap().is_some());
    }
}
