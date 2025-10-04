use crate::{
    Rect, SheetRect,
    controller::active_transactions::pending_transaction::PendingTransaction,
    grid::{SheetId, formats::SheetFormatUpdates, sheet::borders::BordersUpdates},
};

use super::GridController;

impl GridController {
    /// Returns whether the thumbnail contains any intersection with
    /// `sheet_rect`. If this method returns `true`, then updates in
    /// `sheet_rect` must force the thumbnail to update.
    pub(crate) fn thumbnail_dirty_sheet_rect(
        &self,
        transaction: &mut PendingTransaction,
        sheet_rect: SheetRect,
    ) {
        if transaction.is_user_ai_undo_redo()
            && sheet_rect.sheet_id == self.grid().first_sheet_id()
            && let Some(sheet) = self.try_sheet(sheet_rect.sheet_id)
            && Rect::from(sheet_rect).intersects(sheet.offsets.thumbnail())
        {
            transaction.generate_thumbnail = true;
        }
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
        Pos, Rect, SheetRect, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH,
        controller::{
            GridController, active_transactions::pending_transaction::PendingTransaction,
        },
        grid::{
            SheetId,
            formats::{FormatUpdate, SheetFormatUpdates},
            sheet::borders::{BorderStyleCell, BorderStyleTimestamp, BordersUpdates},
        },
    };

    #[test]
    fn test_thumbnail_dirty_sheet_rect() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let mut transaction = PendingTransaction::default();
        gc.thumbnail_dirty_sheet_rect(
            &mut transaction,
            SheetRect::single_pos(Pos { x: 1, y: 1 }, sheet_id),
        );
        assert!(transaction.generate_thumbnail);

        let mut transaction = PendingTransaction::default();
        gc.thumbnail_dirty_sheet_rect(
            &mut transaction,
            SheetRect::single_pos(
                Pos {
                    x: (THUMBNAIL_WIDTH as i64) + 1i64,
                    y: 1,
                },
                sheet_id,
            ),
        );
        assert!(!transaction.generate_thumbnail);

        let mut transaction = PendingTransaction::default();
        gc.thumbnail_dirty_sheet_rect(
            &mut transaction,
            SheetRect::single_pos(
                Pos {
                    x: 1,
                    y: (THUMBNAIL_HEIGHT as i64) + 1i64,
                },
                sheet_id,
            ),
        );
        assert!(!transaction.generate_thumbnail);

        let mut transaction = PendingTransaction::default();
        gc.thumbnail_dirty_sheet_rect(
            &mut transaction,
            SheetRect::single_pos(
                Pos {
                    x: THUMBNAIL_WIDTH as i64,
                    y: THUMBNAIL_HEIGHT as i64,
                },
                sheet_id,
            ),
        );
        assert!(!transaction.generate_thumbnail);
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
