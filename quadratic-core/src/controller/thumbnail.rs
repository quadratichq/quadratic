use crate::{
    grid::{RegionRef, SheetId},
    Pos, Rect,
};

use super::GridController;

impl GridController {
    /// whether the thumbnail needs to be updated for this region
    pub fn thumbnail_dirty_region(&self, region: RegionRef) -> bool {
        if region.sheet != self.grid().first_sheet_id() {
            return false;
        }
        let sheet = self.sheet(region.sheet);
        region.iter().any(|cell_ref| {
            if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                self.thumbnail_dirty_pos(region.sheet, pos)
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
        rect.intersects(sheet.offsets.thumbnail())
    }
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, Pos, Rect, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH};

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
