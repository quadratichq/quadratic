use crate::{
    grid::{formats::SheetFormatUpdates, SheetId},
    selection::OldSelection,
    A1Selection, Rect, SheetPos, SheetRect,
};

use super::GridController;

impl GridController {
    /// Returns whether the thumbnail contains any intersection with
    /// `sheet_rect`. If this method returns `true`, then updates in
    /// `sheet_rect` must force the thumbnail to update.
    pub fn thumbnail_dirty_sheet_pos(&self, sheet_pos: SheetPos) -> bool {
        self.thumbnail_dirty_sheet_rect(sheet_pos.into())
    }

    /// Returns whether the thumbnail contains any intersection with
    /// `sheet_rect`. If this method returns `true`, then updates in
    /// `sheet_rect` must force the thumbnail to update.
    pub fn thumbnail_dirty_sheet_rect(&self, sheet_rect: SheetRect) -> bool {
        if sheet_rect.sheet_id != self.grid().first_sheet_id() {
            return false;
        }
        let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) else {
            return false;
        };
        Rect::from(sheet_rect).intersects(sheet.offsets.thumbnail())
    }

    /// **Deprecated** Nov 2024 in favor of [`Self::does_thumbnail_overlap()`].
    pub fn thumbnail_dirty_selection(&self, selection: &OldSelection) -> bool {
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

    /// Returns whether the thumbnail contains any intersection with
    /// `selection`. If this method returns `true`, then updates in `selection`
    /// must force the thumbnail to update.
    pub fn thumbnail_dirty_a1(&self, selection: &A1Selection) -> bool {
        if selection.sheet_id != self.grid().first_sheet_id() {
            return false;
        }
        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return false;
        };

        selection.ranges.iter().any(|&range| {
            sheet
                .cell_ref_range_to_rect(range)
                .intersects(sheet.offsets.thumbnail())
        })
    }

    /// Returns whether the thumbnail contains any intersection with
    /// `formats`. If this method returns `true`, then updates in `formats`
    /// must force the thumbnail to update.
    pub fn thumbnail_dirty_formats(&self, sheet_id: SheetId, formats: &SheetFormatUpdates) -> bool {
        if sheet_id != self.grid().first_sheet_id() {
            return false;
        }
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return false;
        };
        formats.intersects(sheet.offsets.thumbnail())
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::GridController,
        grid::{
            formats::{FormatUpdate, SheetFormatUpdates},
            SheetId,
        },
        selection::OldSelection,
        Pos, Rect, SheetPos, SheetRect, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH,
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
        assert!(gc.thumbnail_dirty_sheet_rect(SheetRect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 1, y: 1 },
            sheet_id,
        }));
        assert!(!gc.thumbnail_dirty_sheet_rect(SheetRect {
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
        assert!(!gc.thumbnail_dirty_sheet_rect(SheetRect {
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
            SheetPos {
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
        assert!(!gc.thumbnail_dirty_selection(&OldSelection {
            sheet_id: SheetId::test(),
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: None,
            all: true,
        }));
        assert!(gc.thumbnail_dirty_selection(&OldSelection {
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
        assert!(!gc.thumbnail_dirty_selection(&OldSelection {
            sheet_id: SheetId::test(),
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: Some(vec![0]),
            all: false,
        }));
        assert!(gc.thumbnail_dirty_selection(&OldSelection {
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
        assert!(gc.thumbnail_dirty_selection(&OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: Some(vec![max_column]),
            all: false,
        }));
        assert!(!gc.thumbnail_dirty_selection(&OldSelection {
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
        assert!(!gc.thumbnail_dirty_selection(&OldSelection {
            sheet_id: SheetId::test(),
            x: 0,
            y: 0,
            rects: None,
            rows: Some(vec![0]),
            columns: None,
            all: false,
        }));
        assert!(gc.thumbnail_dirty_selection(&OldSelection {
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
        assert!(gc.thumbnail_dirty_selection(&OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: Some(vec![max_row]),
            columns: None,
            all: false,
        }));
        assert!(!gc.thumbnail_dirty_selection(&OldSelection {
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
        assert!(!gc.thumbnail_dirty_selection(&OldSelection {
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
        assert!(gc.thumbnail_dirty_selection(&OldSelection {
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
        assert!(gc.thumbnail_dirty_selection(&OldSelection {
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
        assert!(!gc.thumbnail_dirty_selection(&OldSelection {
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
        assert!(!gc.thumbnail_dirty_selection(&OldSelection {
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

    #[test]
    #[parallel]
    fn test_thumbnail_dirty_formats() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let wrong_sheet_id = SheetId::test();

        // Test with empty formats
        let empty_formats = SheetFormatUpdates::default();
        assert!(!gc.thumbnail_dirty_formats(wrong_sheet_id, &empty_formats));
        assert!(!gc.thumbnail_dirty_formats(sheet_id, &empty_formats));

        // Test with formats that intersect thumbnail
        let mut intersecting_formats = SheetFormatUpdates::default();
        intersecting_formats.set_format_rect(
            Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 1, y: 1 },
            },
            FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
        );
        assert!(!gc.thumbnail_dirty_formats(wrong_sheet_id, &intersecting_formats));
        assert!(gc.thumbnail_dirty_formats(sheet_id, &intersecting_formats));

        // Test with formats outside thumbnail bounds
        let sheet = gc.sheet(sheet_id);
        let mut non_intersecting_formats = SheetFormatUpdates::default();
        non_intersecting_formats.set_format_rect(
            Rect {
                min: Pos {
                    x: sheet.offsets.thumbnail().max.x + 1,
                    y: sheet.offsets.thumbnail().max.y + 1,
                },
                max: Pos {
                    x: sheet.offsets.thumbnail().max.x + 2,
                    y: sheet.offsets.thumbnail().max.y + 2,
                },
            },
            FormatUpdate {
                italic: Some(Some(true)),
                ..Default::default()
            },
        );
        assert!(!gc.thumbnail_dirty_formats(sheet_id, &non_intersecting_formats));
    }
}
