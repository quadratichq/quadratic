//! Data structures for borders.

use std::hash::Hash;

use crate::color::Rgba;
use crate::small_timestamp::SmallTimestamp;
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

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, TS)]
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

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, TS)]
pub struct JsBorder {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub x: i64,
    pub y: i64,
    pub w: Option<i64>,
    pub h: Option<i64>,
    pub side: BorderSide,
    pub time_stamp: i64,
}

impl JsBorder {
    #[cfg(test)]
    pub fn compare_without_timestamp(&self, other: &Self) -> bool {
        self.x == other.x
            && self.y == other.y
            && self.w == other.w
            && self.h == other.h
            && self.side == other.side
            && self.color == other.color
            && self.line == other.line
    }
}

// #[cfg(test)]
// mod tests {
//     use serial_test::parallel;

//     use super::*;

//     #[test]
//     #[parallel]
//     fn apply_update() {
//         let mut cell = BorderStyleCell::default();
//         let update = BorderStyleCellUpdate::all();
//         let original = cell.apply_update(&update);
//         assert_eq!(cell, BorderStyleCell::all());
//         assert!(BorderStyleCellUpdate::is_equal_ignore_timestamp(
//             Some(original),
//             Some(BorderStyleCellUpdate::clear(false))
//         ));
//     }

//     #[test]
//     #[parallel]
//     fn override_border() {
//         let update = BorderStyleCell {
//             top: Some(BorderStyleTimestamp::new(
//                 Rgba::default(),
//                 CellBorderLine::Line2,
//             )),
//             bottom: None,
//             left: None,
//             right: Some(BorderStyleTimestamp::default()),
//         };
//         let updated = update.override_border(false);
//         assert_eq!(updated.top.unwrap().unwrap().line, CellBorderLine::Line2);
//         assert_eq!(updated.bottom, Some(None));
//         assert_eq!(updated.left, Some(None));
//         assert_eq!(updated.right.unwrap().unwrap().line, CellBorderLine::Line1);

//         let updated = update.override_border(true);
//         assert_eq!(updated.top.unwrap().unwrap().line, CellBorderLine::Line2);
//         assert_eq!(updated.bottom, Some(Some(BorderStyleTimestamp::clear())));
//         assert_eq!(updated.left, Some(Some(BorderStyleTimestamp::clear())));
//         assert_eq!(updated.right.unwrap().unwrap().line, CellBorderLine::Line1);
//     }

//     #[test]
//     #[parallel]
//     fn clear() {
//         let cleared = BorderStyleCell::clear();
//         assert_eq!(cleared.top, Some(Some(BorderStyleTimestamp::clear())));
//         assert_eq!(cleared.bottom, Some(Some(BorderStyleTimestamp::clear())));
//         assert_eq!(cleared.left, Some(Some(BorderStyleTimestamp::clear())));
//         assert_eq!(cleared.right, Some(Some(BorderStyleTimestamp::clear())));
//     }

//     #[test]
//     #[parallel]
//     fn timestamp_is_equal_ignore_timestamp() {
//         assert!(BorderStyleTimestamp::is_equal_ignore_timestamp(
//             Some(BorderStyleTimestamp::default()),
//             Some(BorderStyleTimestamp {
//                 timestamp: SmallTimestamp::new(0),
//                 ..BorderStyleTimestamp::default()
//             }),
//         ));
//         assert!(!BorderStyleTimestamp::is_equal_ignore_timestamp(
//             Some(BorderStyleTimestamp::default()),
//             Some(BorderStyleTimestamp::new(
//                 Rgba::default(),
//                 CellBorderLine::Line2
//             )),
//         ));
//     }

//     #[test]
//     #[parallel]
//     fn cell_is_equal_ignore_timestamp() {
//         let b1 = Some(BorderStyleCell::all());
//         let b2 = Some(BorderStyleCell {
//             top: Some(BorderStyleTimestamp {
//                 timestamp: SmallTimestamp::new(1),
//                 ..BorderStyleTimestamp::default()
//             }),
//             bottom: Some(BorderStyleTimestamp {
//                 timestamp: SmallTimestamp::new(1),
//                 ..BorderStyleTimestamp::default()
//             }),
//             left: Some(BorderStyleTimestamp {
//                 timestamp: SmallTimestamp::new(1),
//                 ..BorderStyleTimestamp::default()
//             }),
//             right: Some(BorderStyleTimestamp {
//                 timestamp: SmallTimestamp::new(1),
//                 ..BorderStyleTimestamp::default()
//             }),
//         });
//         assert!(BorderStyleCell::is_equal_ignore_timestamp(b1, b2));

//         let b1 = Some(BorderStyleCell {
//             top: Some(BorderStyleTimestamp::new(
//                 Rgba::default(),
//                 CellBorderLine::Line1,
//             )),
//             ..BorderStyleCell::default()
//         });
//         let b2 = Some(BorderStyleCell {
//             top: Some(BorderStyleTimestamp::new(
//                 Rgba::default(),
//                 CellBorderLine::Line2,
//             )),
//             ..BorderStyleCell::default()
//         });
//         assert!(!BorderStyleCell::is_equal_ignore_timestamp(b1, b2));
//     }

//     #[test]
//     #[parallel]
//     fn remove_clear() {
//         assert_eq!(
//             BorderStyleTimestamp::remove_clear(Some(BorderStyleTimestamp::clear())),
//             None
//         );
//         assert_eq!(
//             BorderStyleTimestamp::remove_clear(Some(BorderStyleTimestamp::default())),
//             Some(BorderStyleTimestamp::default())
//         );
//     }

//     #[test]
//     #[parallel]
//     fn is_empty() {
//         let cell = BorderStyleCell::default();
//         assert!(cell.is_empty());

//         let cell = BorderStyleCell {
//             top: Some(BorderStyleTimestamp::default()),
//             ..BorderStyleCell::default()
//         };
//         assert!(!cell.is_empty());
//     }

//     #[test]
//     #[parallel]
//     fn js_border_horizontal_new() {
//         let border = JsBorderHorizontal::new_test(1, 1, 1);
//         assert_eq!(border.x, 1);
//         assert_eq!(border.y, 1);
//         assert_eq!(border.width, 1);
//     }

//     #[test]
//     #[parallel]
//     fn js_border_vertical_new() {
//         let border = JsBorderVertical::new_test(1, 1, 1);
//         assert_eq!(border.x, 1);
//         assert_eq!(border.y, 1);
//         assert_eq!(border.height, 1);
//     }

//     #[test]
//     #[parallel]
//     fn convert_to_clear() {
//         let update = BorderStyleCellUpdate {
//             top: Some(Some(BorderStyleTimestamp::default())),
//             bottom: Some(Some(BorderStyleTimestamp::default())),
//             left: None,
//             right: Some(Some(BorderStyleTimestamp::default())),
//         };
//         let clear = update.convert_to_clear();
//         assert_eq!(clear.top, Some(None));
//         assert_eq!(clear.bottom, Some(None));
//         assert_eq!(clear.left, None);
//         assert_eq!(clear.right, Some(None));
//     }

//     #[test]
//     #[parallel]
//     fn replace_clear_with_none() {
//         let update = BorderStyleCellUpdate {
//             top: Some(Some(BorderStyleTimestamp::default())),
//             bottom: Some(Some(BorderStyleTimestamp::clear())),
//             left: Some(Some(BorderStyleTimestamp::default())),
//             right: Some(Some(BorderStyleTimestamp::default())),
//         };
//         let updated = update.replace_clear_with_none();
//         assert!(updated.top.unwrap().is_some());
//         assert!(updated.bottom.unwrap().is_none());
//         assert!(updated.left.unwrap().is_some());
//         assert!(updated.right.unwrap().is_some());
//     }
// }
