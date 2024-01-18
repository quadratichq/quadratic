use crate::{SheetPos, SheetRect};

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
}

#[cfg(test)]
mod test {
    use crate::{
        controller::GridController, Pos, SheetPos, SheetRect, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH,
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
}
