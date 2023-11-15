use crate::{
    grid::{RegionRef, SheetId},
    Pos, Rect,
};

use super::GridController;

const THUMBNAIL_WIDTH: u32 = 1280u32;
const THUMBNAIL_HEIGHT: u32 = THUMBNAIL_WIDTH / (16u32 / 9u32);

impl GridController {
    /// whether the thumbnail needs to be updated for this region
    pub fn thumbnail_dirty_region(&self, region: RegionRef) -> bool {
        let sheet = self.sheet(region.sheet);
        region.iter().any(|cell_ref| {
            if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                if self.thumbnail_dirty_pos(region.sheet, pos) {
                    true
                } else {
                    false
                }
            } else {
                false
            }
        })
    }

    /// whether the thumbnail needs to be updated for this Pos
    pub fn thumbnail_dirty_pos(&self, sheet_id: SheetId, pos: Pos) -> bool {
        self.thumbnail_dirty_rect(sheet_id, Rect::single_pos(pos))
    }

    /// whether the thumbnail needs to be updated for this rectangle
    pub fn thumbnail_dirty_rect(&self, sheet_id: SheetId, rect: Rect) -> bool {
        if sheet_id != self.grid().first_sheet_id() {
            return false;
        }
        let sheet = self.sheet(sheet_id);
        let (cols, row) = sheet
            .offsets
            .visible_cols_rows(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
        rect.intersects(Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos {
                x: cols as i64,
                y: row as i64,
            },
        })
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::{
            thumbnail::{THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH},
            GridController,
        },
        Pos, Rect,
    };

    #[test]
    fn test_thumbnail_dirty_pos() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        assert!(gc.thumbnail_dirty_pos(sheet_id, Pos { x: 0, y: 0 }));
        assert!(!gc.thumbnail_dirty_pos(
            sheet_id,
            Pos {
                x: (THUMBNAIL_WIDTH as i64) + 1i64,
                y: 0
            }
        ));
        assert!(!gc.thumbnail_dirty_pos(
            sheet_id,
            Pos {
                x: 0,
                y: (THUMBNAIL_HEIGHT as i64) + 1i64,
            }
        ));
        assert!(!gc.thumbnail_dirty_pos(
            sheet_id,
            Pos {
                x: THUMBNAIL_WIDTH as i64,
                y: THUMBNAIL_HEIGHT as i64,
            }
        ));
    }

    #[test]
    fn test_thumbnail_dirty_rect() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        assert!(gc.thumbnail_dirty_rect(
            sheet_id,
            Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos { x: 1, y: 1 }
            }
        ));
        assert!(!gc.thumbnail_dirty_rect(
            sheet_id,
            Rect {
                min: Pos {
                    x: (THUMBNAIL_WIDTH as i64) + 1i64,
                    y: 0
                },
                max: Pos {
                    x: (THUMBNAIL_WIDTH as i64) + 10i64,
                    y: 0
                }
            }
        ));
        assert!(!gc.thumbnail_dirty_rect(
            sheet_id,
            Rect {
                min: Pos {
                    x: 0,
                    y: (THUMBNAIL_HEIGHT as i64) + 1i64,
                },
                max: Pos {
                    x: 0,
                    y: (THUMBNAIL_HEIGHT as i64) + 10i64,
                }
            }
        ));
        assert!(!gc.thumbnail_dirty_rect(
            sheet_id,
            Rect::single_pos(Pos {
                x: THUMBNAIL_WIDTH as i64,
                y: THUMBNAIL_HEIGHT as i64,
            }),
        ));
    }
}
