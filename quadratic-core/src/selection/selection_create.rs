use crate::{Rect, SheetPos, SheetRect, grid::SheetId};

use super::*;

impl OldSelection {
    pub fn new(sheet_id: SheetId) -> Self {
        OldSelection {
            all: false,
            sheet_id,
            x: 1,
            y: 1,
            rects: None,
            rows: None,
            columns: None,
        }
    }

    /// Creates a selection via a single sheet rect
    pub fn sheet_rect(sheet_rect: SheetRect) -> Self {
        OldSelection {
            sheet_id: sheet_rect.sheet_id,
            x: sheet_rect.min.x,
            y: sheet_rect.min.y,
            rects: Some(vec![sheet_rect.into()]),
            rows: None,
            columns: None,
            all: false,
        }
    }

    /// Creates a selection via a single sheet position
    pub fn sheet_pos(sheet_pos: SheetPos) -> Self {
        OldSelection {
            sheet_id: sheet_pos.sheet_id,
            x: sheet_pos.x,
            y: sheet_pos.y,
            rects: Some(vec![Rect::from_numbers(sheet_pos.x, sheet_pos.y, 1, 1)]),
            rows: None,
            columns: None,
            all: false,
        }
    }

    /// Creates a new selection with a single sheet position
    pub fn new_sheet_pos(x: i64, y: i64, sheet_id: SheetId) -> Self {
        OldSelection {
            sheet_id,
            x,
            y,
            all: false,
            rects: Some(vec![Rect::from_numbers(x, y, 1, 1)]),
            rows: None,
            columns: None,
        }
    }

    /// Creates an all selection
    pub fn all(sheet_id: SheetId) -> Self {
        OldSelection {
            sheet_id,
            all: true,
            ..Default::default()
        }
    }

    /// Creates a selection with columns
    pub fn columns(columns: &[i64], sheet_id: SheetId) -> Self {
        OldSelection {
            sheet_id,
            x: columns[0],
            columns: Some(columns.to_vec()),
            ..Default::default()
        }
    }

    /// Creates a selection with rows
    pub fn rows(rows: &[i64], sheet_id: SheetId) -> Self {
        OldSelection {
            sheet_id,
            y: rows[0],
            rows: Some(rows.to_vec()),
            ..Default::default()
        }
    }

    /// Creates a selection via  single rect
    pub fn rect(rect: Rect, sheet_id: SheetId) -> Self {
        OldSelection {
            sheet_id,
            x: rect.min.x,
            y: rect.min.y,
            rects: Some(vec![rect]),
            ..Default::default()
        }
    }

    /// Creates a selection from a list of rects
    pub fn rects(rects: &[Rect], sheet_id: SheetId) -> Self {
        OldSelection {
            sheet_id,
            x: rects[0].min.x,
            y: rects[0].min.y,
            rects: Some(rects.to_vec()),
            ..Default::default()
        }
    }

    /// Create a selection via a single position.
    pub fn pos(x: i64, y: i64, sheet_id: SheetId) -> Self {
        OldSelection {
            sheet_id,
            x,
            y,
            rects: Some(vec![Rect::from_numbers(x, y, 1, 1)]),
            ..Default::default()
        }
    }
}

impl FromStr for OldSelection {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_str::<OldSelection>(s).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn selection_from_str_rects() {
        let s = r#"{"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"},"x":0,"y":1,"rects":[{"min":{"x":0,"y":1},"max":{"x":3,"y":4}}],"rows":null,"columns":null,"all":false}"#;
        let selection: OldSelection = OldSelection::from_str(s).unwrap();
        assert_eq!(
            selection,
            OldSelection {
                sheet_id: SheetId::TEST,
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
        let selection: OldSelection = OldSelection::from_str(s).unwrap();
        assert_eq!(
            selection,
            OldSelection {
                sheet_id: SheetId::TEST,
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
        let selection: OldSelection = OldSelection::from_str(s).unwrap();
        assert_eq!(
            selection,
            OldSelection {
                x: 7,
                y: 0,
                sheet_id: SheetId::TEST,
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
        let selection: OldSelection = OldSelection::from_str(s).unwrap();
        assert_eq!(
            selection,
            OldSelection {
                x: 0,
                y: 0,
                sheet_id: SheetId::TEST,
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
        let selection = OldSelection::rect(rect, SheetId::TEST);
        assert_eq!(
            selection,
            OldSelection {
                x: 0,
                y: 0,
                sheet_id: SheetId::TEST,
                rects: Some(vec!(rect)),
                rows: None,
                columns: None,
                all: false
            }
        );
    }

    #[test]
    fn selection_from_pos() {
        let selection = OldSelection::pos(0, 0, SheetId::TEST);
        assert_eq!(
            selection,
            OldSelection {
                x: 0,
                y: 0,
                sheet_id: SheetId::TEST,
                rects: Some(vec!(Rect::from_numbers(0, 0, 1, 1))),
                rows: None,
                columns: None,
                all: false
            }
        );
    }

    #[test]
    fn selection_from_sheet_rect() {
        let sheet_rect = SheetRect::from_numbers(0, 0, 1, 1, SheetId::TEST);
        let selection = OldSelection::sheet_rect(sheet_rect);
        assert_eq!(
            selection,
            OldSelection {
                x: 0,
                y: 0,
                sheet_id: SheetId::TEST,
                rects: Some(vec!(Rect::from_numbers(0, 0, 1, 1))),
                rows: None,
                columns: None,
                all: false
            }
        );
    }

    #[test]
    fn selection_sheet_pos() {
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id: SheetId::TEST,
        };
        let selection = OldSelection::sheet_pos(sheet_pos);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id: sheet_pos.sheet_id,
                x: sheet_pos.x,
                y: sheet_pos.y,
                rects: Some(vec![Rect::from_numbers(sheet_pos.x, sheet_pos.y, 1, 1)]),
                rows: None,
                columns: None,
                all: false,
            }
        );
    }

    #[test]
    fn new_sheet_pos() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection::new_sheet_pos(1, 1, sheet_id);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id,
                x: 1,
                y: 1,
                rects: Some(vec![Rect::new(1, 1, 1, 1)]),
                ..Default::default()
            }
        );
    }

    #[test]
    fn new() {
        let selection = OldSelection::new(SheetId::TEST);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id: SheetId::TEST,
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_rects() {
        let rects = vec![Rect::new(1, 1, 2, 2), Rect::new(3, 3, 4, 4)];
        let selection = OldSelection::rects(&rects, SheetId::TEST);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id: SheetId::TEST,
                rects: Some(rects),
                ..Default::default()
            }
        );
    }
}
