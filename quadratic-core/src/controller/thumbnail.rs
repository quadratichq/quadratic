use crate::{
    a1::A1Selection,
    grid::{formats::SheetFormatUpdates, sheet::borders::BordersUpdates, SheetId},
    Rect, SheetPos, SheetRect,
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

        let thumbnail_a1 =
            A1Selection::from_rect(sheet.offsets.thumbnail().to_sheet_rect(sheet.id));

        let context = self.grid().a1_context();
        selection.overlaps_a1_selection(&thumbnail_a1, &context)
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

    /// Returns whether the thumbnail contains any intersection with
    /// `borders`. If this method returns `true`, then updates in `borders`
    /// must force the thumbnail to update.
    pub fn thumbnail_dirty_borders(&self, sheet_id: SheetId, borders: &BordersUpdates) -> bool {
        if sheet_id != self.grid().first_sheet_id() {
            return false;
        }
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return false;
        };
        borders.intersects(sheet.offsets.thumbnail())
    }
}

#[cfg(test)]
mod test {
    use crate::{
        a1::A1Selection,
        controller::GridController,
        grid::{
            formats::{FormatUpdate, SheetFormatUpdates},
            sheet::borders::{BorderStyleCell, BorderStyleTimestamp, BordersUpdates},
            SheetId,
        },
        Pos, Rect, SheetPos, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH,
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
    fn test_thumbnail_dirty_a1() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let wrong_sheet_id = SheetId::new();

        assert!(gc.thumbnail_dirty_a1(&A1Selection::test_a1_sheet_id("A1", &sheet_id)));
        assert!(!gc.thumbnail_dirty_a1(&A1Selection::test_a1_sheet_id("A1", &wrong_sheet_id)));

        assert!(!gc.thumbnail_dirty_a1(&A1Selection::test_a1_sheet_id("O1:O", &sheet_id)));
        assert!(!gc.thumbnail_dirty_a1(&A1Selection::test_a1_sheet_id("A75:75", &sheet_id)));
    }

    #[test]
    fn test_thumbnail_dirty_formats() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let wrong_sheet_id = SheetId::new();

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

    #[test]
    fn test_thumbnail_dirty_borders() {
        let gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let wrong_sheet_id = SheetId::new();

        // Test with empty formats
        let empty_borders = BordersUpdates::default();
        assert!(!gc.thumbnail_dirty_borders(wrong_sheet_id, &empty_borders));
        assert!(!gc.thumbnail_dirty_borders(sheet_id, &empty_borders));

        // Test with formats that intersect thumbnail
        let mut intersecting_borders = BordersUpdates::default();
        intersecting_borders.set_style_cell(
            pos![A1],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        assert!(!gc.thumbnail_dirty_borders(wrong_sheet_id, &intersecting_borders));
        assert!(gc.thumbnail_dirty_borders(sheet_id, &intersecting_borders));

        // Test with borders outside thumbnail bounds
        let sheet = gc.sheet(sheet_id);
        let mut non_intersecting_borders = BordersUpdates::default();
        non_intersecting_borders.set_style_cell(
            (
                sheet.offsets.thumbnail().max.x + 1,
                sheet.offsets.thumbnail().max.y + 1,
            )
                .into(),
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        assert!(!gc.thumbnail_dirty_borders(sheet_id, &non_intersecting_borders));
    }
}
