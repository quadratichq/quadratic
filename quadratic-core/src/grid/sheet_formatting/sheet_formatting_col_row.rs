//! Mutating sheet formatting for columns and rows.

use super::*;

use std::fmt::Debug;

use crate::{
    CopyFormats,
    grid::formats::{SheetFormatUpdates, SheetFormatUpdatesType},
};

impl SheetFormatting {
    pub(crate) fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) {
        self.align.insert_column(column, copy_formats);
        self.vertical_align.insert_column(column, copy_formats);
        self.wrap.insert_column(column, copy_formats);
        self.numeric_format.insert_column(column, copy_formats);
        self.numeric_decimals.insert_column(column, copy_formats);
        self.numeric_commas.insert_column(column, copy_formats);
        self.bold.insert_column(column, copy_formats);
        self.italic.insert_column(column, copy_formats);
        self.text_color.insert_column(column, copy_formats);
        self.fill_color.insert_column(column, copy_formats);
        self.date_time.insert_column(column, copy_formats);
        self.underline.insert_column(column, copy_formats);
        self.strike_through.insert_column(column, copy_formats);
    }

    pub(crate) fn insert_row(&mut self, row: i64, copy_formats: CopyFormats) {
        self.align.insert_row(row, copy_formats);
        self.vertical_align.insert_row(row, copy_formats);
        self.wrap.insert_row(row, copy_formats);
        self.numeric_format.insert_row(row, copy_formats);
        self.numeric_decimals.insert_row(row, copy_formats);
        self.numeric_commas.insert_row(row, copy_formats);
        self.bold.insert_row(row, copy_formats);
        self.italic.insert_row(row, copy_formats);
        self.text_color.insert_row(row, copy_formats);
        self.fill_color.insert_row(row, copy_formats);
        self.date_time.insert_row(row, copy_formats);
        self.underline.insert_row(row, copy_formats);
        self.strike_through.insert_row(row, copy_formats);
    }

    fn remove_column_item<T>(
        item: &mut SheetFormattingType<T>,
        column: i64,
    ) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        item.remove_column(column)
            .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.into())))
    }

    pub(crate) fn remove_column(&mut self, column: i64) -> SheetFormatUpdates {
        SheetFormatUpdates {
            align: Self::remove_column_item(&mut self.align, column),
            vertical_align: Self::remove_column_item(&mut self.vertical_align, column),
            wrap: Self::remove_column_item(&mut self.wrap, column),
            numeric_format: Self::remove_column_item(&mut self.numeric_format, column),
            numeric_decimals: Self::remove_column_item(&mut self.numeric_decimals, column),
            numeric_commas: Self::remove_column_item(&mut self.numeric_commas, column),
            bold: Self::remove_column_item(&mut self.bold, column),
            italic: Self::remove_column_item(&mut self.italic, column),
            text_color: Self::remove_column_item(&mut self.text_color, column),
            fill_color: Self::remove_column_item(&mut self.fill_color, column),
            date_time: Self::remove_column_item(&mut self.date_time, column),
            underline: Self::remove_column_item(&mut self.underline, column),
            strike_through: Self::remove_column_item(&mut self.strike_through, column),
        }
    }

    fn copy_column_item<T>(item: &SheetFormattingType<T>, column: i64) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        item.copy_column(column)
            .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.into())))
    }

    pub(crate) fn copy_column(&self, column: i64) -> Option<SheetFormatUpdates> {
        let updates = SheetFormatUpdates {
            align: Self::copy_column_item(&self.align, column),
            vertical_align: Self::copy_column_item(&self.vertical_align, column),
            wrap: Self::copy_column_item(&self.wrap, column),
            numeric_format: Self::copy_column_item(&self.numeric_format, column),
            numeric_decimals: Self::copy_column_item(&self.numeric_decimals, column),
            numeric_commas: Self::copy_column_item(&self.numeric_commas, column),
            bold: Self::copy_column_item(&self.bold, column),
            italic: Self::copy_column_item(&self.italic, column),
            text_color: Self::copy_column_item(&self.text_color, column),
            fill_color: Self::copy_column_item(&self.fill_color, column),
            date_time: Self::copy_column_item(&self.date_time, column),
            underline: Self::copy_column_item(&self.underline, column),
            strike_through: Self::copy_column_item(&self.strike_through, column),
        };

        if updates.is_default() {
            None
        } else {
            Some(updates)
        }
    }

    fn remove_row_item<T>(item: &mut SheetFormattingType<T>, row: i64) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        item.remove_row(row)
            .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.into())))
    }

    pub(crate) fn remove_row(&mut self, row: i64) -> SheetFormatUpdates {
        SheetFormatUpdates {
            align: Self::remove_row_item(&mut self.align, row),
            vertical_align: Self::remove_row_item(&mut self.vertical_align, row),
            wrap: Self::remove_row_item(&mut self.wrap, row),
            numeric_format: Self::remove_row_item(&mut self.numeric_format, row),
            numeric_decimals: Self::remove_row_item(&mut self.numeric_decimals, row),
            numeric_commas: Self::remove_row_item(&mut self.numeric_commas, row),
            bold: Self::remove_row_item(&mut self.bold, row),
            italic: Self::remove_row_item(&mut self.italic, row),
            text_color: Self::remove_row_item(&mut self.text_color, row),
            fill_color: Self::remove_row_item(&mut self.fill_color, row),
            date_time: Self::remove_row_item(&mut self.date_time, row),
            underline: Self::remove_row_item(&mut self.underline, row),
            strike_through: Self::remove_row_item(&mut self.strike_through, row),
        }
    }

    fn copy_row_item<T>(item: &SheetFormattingType<T>, row: i64) -> SheetFormatUpdatesType<T>
    where
        T: Clone + Debug + PartialEq,
    {
        item.copy_row(row)
            .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.into())))
    }

    pub(crate) fn copy_row(&self, row: i64) -> Option<SheetFormatUpdates> {
        let updates = SheetFormatUpdates {
            align: Self::copy_row_item(&self.align, row),
            vertical_align: Self::copy_row_item(&self.vertical_align, row),
            wrap: Self::copy_row_item(&self.wrap, row),
            numeric_format: Self::copy_row_item(&self.numeric_format, row),
            numeric_decimals: Self::copy_row_item(&self.numeric_decimals, row),
            numeric_commas: Self::copy_row_item(&self.numeric_commas, row),
            bold: Self::copy_row_item(&self.bold, row),
            italic: Self::copy_row_item(&self.italic, row),
            text_color: Self::copy_row_item(&self.text_color, row),
            fill_color: Self::copy_row_item(&self.fill_color, row),
            date_time: Self::copy_row_item(&self.date_time, row),
            underline: Self::copy_row_item(&self.underline, row),
            strike_through: Self::copy_row_item(&self.strike_through, row),
        };

        if updates.is_default() {
            None
        } else {
            Some(updates)
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::ClearOption;

    use super::*;

    #[test]
    fn test_insert_column() {
        let mut formatting = SheetFormatting::default();
        formatting.bold.set(pos![A1], Some(true));
        formatting.italic.set(pos![A2], Some(true));
        formatting.text_color.set(pos![A3], Some("red".to_string()));
        formatting.align.set(pos![A4], Some(CellAlign::Center));

        // Insert column at position 1 with copy formats
        formatting.insert_column(1, CopyFormats::After);

        // Check if values were inserted correctly
        assert_eq!(formatting.bold.get(pos![A1]), Some(true));
        assert_eq!(formatting.italic.get(pos![A2]), Some(true));
        assert_eq!(formatting.text_color.get(pos![A3]), Some("red".to_string()));
        assert_eq!(formatting.align.get(pos![A4]), Some(CellAlign::Center));

        // Check if values were shifted correctly
        assert_eq!(formatting.bold.get(pos![B1]), Some(true));
        assert_eq!(formatting.italic.get(pos![B2]), Some(true));
        assert_eq!(formatting.text_color.get(pos![B3]), Some("red".to_string()));
        assert_eq!(formatting.align.get(pos![B4]), Some(CellAlign::Center));
    }

    #[test]
    fn test_insert_row() {
        let mut formatting = SheetFormatting::default();
        formatting.bold.set(pos![A1], Some(true));
        formatting.italic.set(pos![B1], Some(true));
        formatting.text_color.set(pos![C1], Some("red".to_string()));
        formatting.align.set(pos![D1], Some(CellAlign::Center));

        formatting.insert_row(1, CopyFormats::After);

        // Check if values were inserted correctly
        assert_eq!(formatting.bold.get(pos![A1]), Some(true));
        assert_eq!(formatting.italic.get(pos![B1]), Some(true));
        assert_eq!(formatting.text_color.get(pos![C1]), Some("red".to_string()));
        assert_eq!(formatting.align.get(pos![D1]), Some(CellAlign::Center));

        // Check if values were shifted correctly
        assert_eq!(formatting.bold.get(pos![A2]), Some(true));
        assert_eq!(formatting.italic.get(pos![B2]), Some(true));
        assert_eq!(formatting.text_color.get(pos![C2]), Some("red".to_string()));
        assert_eq!(formatting.align.get(pos![D2]), Some(CellAlign::Center));
    }

    #[test]
    fn test_remove_column() {
        let mut formatting = SheetFormatting::default();
        formatting.bold.set(pos![A1], Some(true));
        formatting.italic.set(pos![A2], Some(true));
        formatting.text_color.set(pos![A3], Some("red".to_string()));
        formatting.align.set(pos![A4], Some(CellAlign::Center));

        let updates = formatting.remove_column(1);

        // Should be no values left
        assert_eq!(formatting.bold.get(pos![A1]), None);
        assert_eq!(formatting.italic.get(pos![A2]), None);
        assert_eq!(formatting.text_color.get(pos![A3]), None);
        assert_eq!(formatting.align.get(pos![A4]), None);

        // undo the changes
        formatting.apply_updates(&updates);
        assert_eq!(formatting.bold.get(pos![A1]), Some(true));
        assert_eq!(formatting.italic.get(pos![A2]), Some(true));
        assert_eq!(formatting.text_color.get(pos![A3]), Some("red".to_string()));
        assert_eq!(formatting.align.get(pos![A4]), Some(CellAlign::Center));
    }

    #[test]
    fn test_remove_row() {
        let mut formatting = SheetFormatting::default();
        formatting.bold.set(pos![A1], Some(true));
        formatting.italic.set(pos![B1], Some(true));
        formatting.text_color.set(pos![C1], Some("red".to_string()));
        formatting.align.set(pos![D1], Some(CellAlign::Center));

        let updates = formatting.remove_row(1);

        // check if row was removed
        assert_eq!(formatting.bold.get(pos![A1]), None);
        assert_eq!(formatting.italic.get(pos![B1]), None);
        assert_eq!(formatting.text_color.get(pos![C1]), None);
        assert_eq!(formatting.align.get(pos![D1]), None);

        // undo the changes
        formatting.apply_updates(&updates);
        assert_eq!(formatting.bold.get(pos![A1]), Some(true));
        assert_eq!(formatting.italic.get(pos![B1]), Some(true));
        assert_eq!(formatting.text_color.get(pos![C1]), Some("red".to_string()));
        assert_eq!(formatting.align.get(pos![D1]), Some(CellAlign::Center));
    }

    #[test]
    fn test_copy_column() {
        let mut formatting = SheetFormatting::default();
        formatting.bold.set(pos![A1], Some(true));
        formatting.italic.set(pos![A2], Some(true));
        formatting.text_color.set(pos![A3], Some("red".to_string()));
        formatting.align.set(pos![A4], Some(CellAlign::Center));

        let updates = formatting.copy_column(1).unwrap();
        assert_eq!(
            updates.bold.as_ref().unwrap().get(pos![A1]),
            Some(ClearOption::Some(true))
        );
        assert_eq!(
            updates.italic.as_ref().unwrap().get(pos![A2]),
            Some(ClearOption::Some(true))
        );
        assert_eq!(
            updates.text_color.as_ref().unwrap().get(pos![A3]),
            Some(ClearOption::Some("red".to_string()))
        );
        assert_eq!(
            updates.align.as_ref().unwrap().get(pos![A4]),
            Some(ClearOption::Some(CellAlign::Center))
        );
        assert_eq!(updates.align.as_ref().unwrap().get(pos![B1]), None);
    }

    #[test]
    fn test_copy_row() {
        let mut formatting = SheetFormatting::default();
        formatting.bold.set(pos![A1], Some(true));
        formatting.italic.set(pos![B1], Some(true));
        formatting.text_color.set(pos![C1], Some("red".to_string()));
        formatting.align.set(pos![D1], Some(CellAlign::Center));

        let updates = formatting.copy_row(1).unwrap();
        assert_eq!(
            updates.bold.as_ref().unwrap().get(pos![A1]),
            Some(ClearOption::Some(true))
        );
        assert_eq!(
            updates.italic.as_ref().unwrap().get(pos![B1]),
            Some(ClearOption::Some(true))
        );
        assert_eq!(
            updates.text_color.as_ref().unwrap().get(pos![C1]),
            Some(ClearOption::Some("red".to_string()))
        );
        assert_eq!(
            updates.align.as_ref().unwrap().get(pos![D1]),
            Some(ClearOption::Some(CellAlign::Center))
        );
        assert_eq!(updates.align.as_ref().unwrap().get(pos![A1]), None);
    }
}
