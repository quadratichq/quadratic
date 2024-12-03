use crate::{controller::operations::operation::Operation, grid::formats::SheetFormatUpdates};

use super::*;

impl Sheet {
    /// Returns the dirty hashes and rows changed for the formats
    fn formats_transaction_changes(
        &self,
        formats: &SheetFormatUpdates,
    ) -> (HashSet<Pos>, HashSet<i64>) {
        let mut dirty_hashes = HashSet::new();
        let mut rows_changed = HashSet::new();

        if let GridBounds::NonEmpty(bounds) = self.bounds(true) {
            if let Some(align) = formats.align.as_ref() {
                align.to_rects().for_each(|(x1, y1, x2, y2, _)| {
                    let x2 = x2.unwrap_or(bounds.max.x);
                    let y2 = y2.unwrap_or(bounds.max.y);
                    for y in y1..=y2 {
                        rows_changed.insert(y);
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
            }
        }
        (dirty_hashes, rows_changed)
    }

    /// Sets formats using SheetFormatUpdates.
    ///
    /// Returns (reverse_operations, dirty_hashes, resize_rows)
    pub fn set_formats_a1(
        &mut self,
        formats: &SheetFormatUpdates,
    ) -> (Vec<Operation>, HashSet<Pos>, HashSet<i64>) {
        let reverse_formats = self.formats.apply_updates(formats);
        let reverse_op = Operation::SetCellFormatsA1 {
            sheet_id: self.id,
            formats: reverse_formats,
        };
        let (dirty_hashes, rows_changed) = self.formats_transaction_changes(formats);
        (vec![reverse_op], dirty_hashes, rows_changed)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    #[test]
    fn test_formats_transaction_changes() {
        todo!()
    }
}
