use crate::{selection::Selection, SheetPos, SheetRect};

use super::GridController;

impl GridController {
    /// whether the thumbnail needs to be updated for this Pos
    pub fn thumbnail_dirty_sheet_pos(&self, sheet_pos: SheetPos) -> bool {
        self.thumbnail_dirty_sheet_rect(&sheet_pos.into())
    }

    /// whether the thumbnail needs to be updated for this rectangle
    pub fn thumbnail_dirty_sheet_rect(&self, sheet_rect: &SheetRect) -> bool {
        if sheet_rect.sheet_id != self.grid().first_sheet_id() {
            return false;
        }
        let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) else {
            return false;
        };
        sheet_rect.intersects(sheet.offsets.thumbnail().to_sheet_rect(sheet_rect.sheet_id))
    }

    /// Whether the thumbnail needs to be updated for this Selection
    pub fn thumbnail_dirty_selection(&self, selection: &Selection) -> bool {
        if selection.sheet_id != self.grid().first_sheet_id() {
            return false;
        }
        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return false;
        };
        if selection.all {
            true
        } else if let Some(columns) = &selection.columns {
            columns
                .iter()
                .any(|&column| column >= 0 && column <= sheet.offsets.thumbnail().max.x)
        } else if let Some(rows) = &selection.rows {
            rows.iter()
                .any(|&row| row >= 0 && row <= sheet.offsets.thumbnail().max.y)
        } else if let Some(rects) = &selection.rects {
            rects
                .iter()
                .any(|rect| rect.intersects(sheet.offsets.thumbnail()))
        } else {
            false
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::GridController, grid::SheetId, selection::Selection, Pos, Rect, SheetPos,
        SheetRect, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH,
    };
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_thumbnail_dirty_pos() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert!(gc.thumbnail_dirty_sheet_pos(SheetPos {
            x: 0,
            y: 0,
            sheet_id
        }));
        assert!(!gc.thumbnail_dirty_sheet_pos(SheetPos {
            x: (THUMBNAIL_WIDTH as i64) + 1i64,
            y: 0,
            sheet_id
        }));
        assert!(!gc.thumbnail_dirty_sheet_pos(SheetPos {
            x: 0,
            y: (THUMBNAIL_HEIGHT as i64) + 1i64,
            sheet_id
        }));
        assert!(!gc.thumbnail_dirty_sheet_pos(SheetPos {
            x: THUMBNAIL_WIDTH as i64,
            y: THUMBNAIL_HEIGHT as i64,
            sheet_id
        }));
    }

    #[test]
    #[parallel]
    fn test_thumbnail_dirty_rect() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert!(gc.thumbnail_dirty_sheet_rect(&SheetRect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 1, y: 1 },
            sheet_id,
        }));
        assert!(!gc.thumbnail_dirty_sheet_rect(&SheetRect {
            min: Pos {
                x: (THUMBNAIL_WIDTH as i64) + 1i64,
                y: 0
            },
            max: Pos {
                x: (THUMBNAIL_WIDTH as i64) + 10i64,
                y: 0
            },
            sheet_id,
        }));
        assert!(!gc.thumbnail_dirty_sheet_rect(&SheetRect {
            min: Pos {
                x: 0,
                y: (THUMBNAIL_HEIGHT as i64) + 1i64,
            },
            max: Pos {
                x: 0,
                y: (THUMBNAIL_HEIGHT as i64) + 10i64,
            },
            sheet_id,
        }));
        assert!(!gc.thumbnail_dirty_sheet_rect(
            &SheetPos {
                x: THUMBNAIL_WIDTH as i64,
                y: THUMBNAIL_HEIGHT as i64,
                sheet_id
            }
            .into(),
        ));
    }

    #[test]
    #[parallel]
    fn thumbnail_dirty_selection_all() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id: SheetId::test(),
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: None,
            all: true,
        }));
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: None,
            all: true,
        }));
    }

    #[test]
    #[parallel]
    fn thumbnail_dirty_selection_columns() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id: SheetId::test(),
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: Some(vec![0]),
            all: false,
        }));
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: Some(vec![0]),
            all: false,
        }));
        let sheet = gc.sheet(sheet_id);
        let max_column = sheet.offsets.thumbnail().max.x;
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: Some(vec![max_column]),
            all: false,
        }));
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: Some(vec![max_column + 1]),
            all: false,
        }));
    }

    #[test]
    #[parallel]
    fn thumbnail_dirty_selection_rows() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id: SheetId::test(),
            x: 0,
            y: 0,
            rects: None,
            rows: Some(vec![0]),
            columns: None,
            all: false,
        }));
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: Some(vec![0]),
            columns: None,
            all: false,
        }));
        let sheet = gc.sheet(sheet_id);
        let max_row = sheet.offsets.thumbnail().max.y;
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: Some(vec![max_row]),
            columns: None,
            all: false,
        }));
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: Some(vec![max_row + 1]),
            columns: None,
            all: false,
        }));
    }

    #[test]
    #[parallel]
    fn thumbnail_dirty_selection_rects() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id: SheetId::test(),
            x: 0,
            y: 0,
            rects: Some(vec![Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 1, y: 1 },
            }]),
            rows: None,
            columns: None,
            all: false,
        }));
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 1, y: 1 },
            }]),
            rows: None,
            columns: None,
            all: false,
        }));
        let sheet = gc.sheet(sheet_id);
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos {
                    x: sheet.offsets.thumbnail().max.x,
                    y: sheet.offsets.thumbnail().max.y
                },
            }]),
            rows: None,
            columns: None,
            all: false,
        }));
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![Rect {
                min: Pos {
                    x: sheet.offsets.thumbnail().max.x + 1,
                    y: sheet.offsets.thumbnail().max.y + 1
                },
                max: Pos {
                    x: sheet.offsets.thumbnail().max.x + 2,
                    y: sheet.offsets.thumbnail().max.y + 2
                },
            }]),
            rows: None,
            columns: None,
            all: false,
        }));
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![Rect {
                min: Pos { x: -2, y: -2 },
                max: Pos { x: -1, y: -1 },
            }]),
            rows: None,
            columns: None,
            all: false,
        }));
    }
}
