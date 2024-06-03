use std::str::FromStr;

use crate::{grid::SheetId, Pos, Rect, SheetRect};
use serde::{Deserialize, Serialize};

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct Selection {
    pub sheet_id: SheetId,

    // cursor position
    pub x: i64,
    pub y: i64,

    // These are used instead of an Enum to make the TS conversion easier.
    pub rects: Option<Vec<Rect>>,
    pub rows: Option<Vec<i64>>,
    pub columns: Option<Vec<i64>>,
    pub all: bool,
}

impl Selection {
    pub fn all() -> Self {
        Selection {
            sheet_id: SheetId::default(),
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: None,
            all: true,
        }
    }

    /// Creates a selection via a single sheet rect
    pub fn sheet_rect(sheet_rect: SheetRect) -> Self {
        Selection {
            sheet_id: sheet_rect.sheet_id,
            x: sheet_rect.min.x,
            y: sheet_rect.min.y,
            rects: Some(vec![sheet_rect.into()]),
            rows: None,
            columns: None,
            all: false,
        }
    }

    /// Creates a selection via  single rect
    pub fn rect(rect: Rect, sheet_id: SheetId) -> Self {
        Selection {
            sheet_id,
            x: rect.min.x,
            y: rect.min.y,
            rects: Some(vec![rect]),
            rows: None,
            columns: None,
            all: false,
        }
    }

    /// Create a selection via a single position.
    pub fn pos(x: i64, y: i64, sheet_id: SheetId) -> Self {
        Selection {
            sheet_id,
            x,
            y,
            rects: Some(vec![Rect::from_numbers(x, y, 1, 1)]),
            rows: None,
            columns: None,
            all: false,
        }
    }

    pub fn has_sheet_selection(&self) -> bool {
        self.rows.is_some() || self.columns.is_some() || self.all
    }

    pub fn source(&self) -> Pos {
        Pos {
            x: self.x,
            y: self.y,
        }
    }

    pub fn count(&self) -> usize {
        if let Some(ref rects) = self.rects {
            rects.iter().map(|r| r.count()).sum()
        } else if let Some(ref rows) = self.rows {
            rows.len()
        } else if let Some(ref columns) = self.columns {
            columns.len()
        } else if self.all {
            1
        } else {
            0
        }
    }

    /// Gets the encompassing rect for selection.rects. Returns None if there are no rects.
    pub fn largest_rect(&self) -> Option<SheetRect> {
        if let Some(rects) = self.rects.as_ref() {
            let mut min_x = i64::MAX;
            let mut max_x = i64::MIN;
            let mut min_y = i64::MAX;
            let mut max_y = i64::MIN;
            rects.iter().for_each(|rect| {
                min_x = min_x.min(rect.min.x);
                max_x = max_x.max(rect.max.x);
                min_y = min_y.min(rect.min.y);
                max_y = max_y.max(rect.max.y);
            });
            if min_x != i64::MAX && min_y != i64::MAX {
                Some(SheetRect {
                    sheet_id: self.sheet_id,
                    min: Pos { x: min_x, y: min_y },
                    max: Pos { x: max_x, y: max_y },
                })
            } else {
                None
            }
        } else {
            None
        }
    }
}

impl FromStr for Selection {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_str::<Selection>(s).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn selection_from_str_rects() {
        let s = r#"{"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"},"x":0,"y":1,"rects":[{"min":{"x":0,"y":1},"max":{"x":3,"y":4}}],"rows":null,"columns":null,"all":false}"#;
        let selection: Selection = Selection::from_str(s).unwrap();
        assert_eq!(
            selection,
            Selection {
                sheet_id: SheetId::test(),
                x: 0,
                y: 1,
                rects: Some(vec![Rect::from_numbers(0, 1, 4, 4)]),
                rows: None,
                columns: None,
                all: false
            }
        );
    }

    #[test]
    fn selection_from_str_rows() {
        let s = r#"{"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"},"x":0,"y":3,"rects":null,"rows":[3,5],"columns":null,"all":false}"#;
        let selection: Selection = Selection::from_str(s).unwrap();
        assert_eq!(
            selection,
            Selection {
                sheet_id: SheetId::test(),
                x: 0,
                y: 3,
                rects: None,
                rows: Some(vec!(3, 5)),
                columns: None,
                all: false
            }
        );
    }

    #[test]
    fn selection_from_str_columns() {
        let s = r#"{"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"},"x":7,"y":0,"rects":null,"rows":null,"columns":[7, 8, 9],"all":false}"#;
        let selection: Selection = Selection::from_str(s).unwrap();
        assert_eq!(
            selection,
            Selection {
                x: 7,
                y: 0,
                sheet_id: SheetId::test(),
                rects: None,
                rows: None,
                columns: Some(vec!(7, 8, 9)),
                all: false
            }
        );
    }

    #[test]
    fn selection_from_str_all() {
        let s = r#"{"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"},"x":0,"y":0,"rects":null,"rows":null,"columns":null,"all":true}"#;
        let selection: Selection = Selection::from_str(s).unwrap();
        assert_eq!(
            selection,
            Selection {
                x: 0,
                y: 0,
                sheet_id: SheetId::test(),
                rects: None,
                rows: None,
                columns: None,
                all: true
            }
        );
    }

    #[test]
    fn selection_from_rect() {
        let rect = Rect::from_numbers(0, 0, 1, 1);
        let selection = Selection::rect(rect, SheetId::test());
        assert_eq!(
            selection,
            Selection {
                x: 0,
                y: 0,
                sheet_id: SheetId::test(),
                rects: Some(vec!(rect)),
                rows: None,
                columns: None,
                all: false
            }
        );
    }

    #[test]
    fn selection_from_pos() {
        let selection = Selection::pos(0, 0, SheetId::test());
        assert_eq!(
            selection,
            Selection {
                x: 0,
                y: 0,
                sheet_id: SheetId::test(),
                rects: Some(vec!(Rect::from_numbers(0, 0, 1, 1))),
                rows: None,
                columns: None,
                all: false
            }
        );
    }

    #[test]
    fn selection_from_sheet_rect() {
        let sheet_rect = SheetRect::from_numbers(0, 0, 1, 1, SheetId::test());
        let selection = Selection::sheet_rect(sheet_rect);
        assert_eq!(
            selection,
            Selection {
                x: 0,
                y: 0,
                sheet_id: SheetId::test(),
                rects: Some(vec!(Rect::from_numbers(0, 0, 1, 1))),
                rows: None,
                columns: None,
                all: false
            }
        );
    }

    #[test]
    fn largest_rect() {
        let sheet_id = SheetId::test();
        let selection = Selection {
            sheet_id,
            all: true,
            ..Default::default()
        };
        assert_eq!(selection.largest_rect(), None);

        let selection = Selection {
            sheet_id,
            rows: Some(vec![1, 2, 3]),
            ..Default::default()
        };
        assert_eq!(selection.largest_rect(), None);

        let selection = Selection {
            sheet_id,
            columns: Some(vec![1, 2, 3]),
            ..Default::default()
        };
        assert_eq!(selection.largest_rect(), None);

        let selection = Selection {
            sheet_id,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            ..Default::default()
        };
        assert_eq!(
            selection.largest_rect(),
            Some(SheetRect::from_numbers(1, 2, 3, 4, sheet_id))
        );
    }

    #[test]
    fn all() {
        let selection = Selection::all();
        assert_eq!(
            selection,
            Selection {
                sheet_id: SheetId::default(),
                x: 0,
                y: 0,
                rects: None,
                rows: None,
                columns: None,
                all: true
            }
        );
    }
}
