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

    #[test]
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
    fn thumbnail_dirty_selection_all() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert!(!gc.thumbnail_dirty_selection(&Selection::all(SheetId::test())));
        assert!(gc.thumbnail_dirty_selection(&Selection::all(sheet_id)));
    }

    #[test]
    fn thumbnail_dirty_selection_columns() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id: SheetId::test(),
            columns: Some(vec![0]),
            ..Default::default()
        }));
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            columns: Some(vec![0]),
            ..Default::default()
        }));
        let sheet = gc.sheet(sheet_id);
        let max_column = sheet.offsets.thumbnail().max.x;
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            columns: Some(vec![max_column]),
            ..Default::default()
        }));
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            columns: Some(vec![max_column + 1]),
            ..Default::default()
        }));
    }

    #[test]
    fn thumbnail_dirty_selection_rows() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id: SheetId::test(),
            rows: Some(vec![0]),
            ..Default::default()
        }));
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            rows: Some(vec![0]),
            ..Default::default()
        }));
        let sheet = gc.sheet(sheet_id);
        let max_row = sheet.offsets.thumbnail().max.y;
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            rows: Some(vec![max_row]),
            ..Default::default()
        }));
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            rows: Some(vec![max_row + 1]),
            ..Default::default()
        }));
    }

    #[test]
    fn thumbnail_dirty_selection_rects() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id: SheetId::test(),
            rects: Some(vec![Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 1, y: 1 },
            }]),
            ..Default::default()
        }));
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            rects: Some(vec![Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 1, y: 1 },
            }]),
            ..Default::default()
        }));
        let sheet = gc.sheet(sheet_id);
        assert!(gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            rects: Some(vec![Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos {
                    x: sheet.offsets.thumbnail().max.x,
                    y: sheet.offsets.thumbnail().max.y
                },
            }]),
            ..Default::default()
        }));
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
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
            ..Default::default()
        }));
        assert!(!gc.thumbnail_dirty_selection(&Selection {
            sheet_id,
            rects: Some(vec![Rect {
                min: Pos { x: -2, y: -2 },
                max: Pos { x: -1, y: -1 },
            }]),
            ..Default::default()
        }));
    }
}
