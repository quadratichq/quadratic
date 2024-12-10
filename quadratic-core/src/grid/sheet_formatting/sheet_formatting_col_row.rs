//! Mutating sheet formatting for columns and rows.

use super::*;

use crate::{grid::formats::SheetFormatUpdates, CopyFormats};

impl SheetFormatting {
    pub fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) {
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
        self.render_size.insert_column(column, copy_formats);
        self.date_time.insert_column(column, copy_formats);
        self.underline.insert_column(column, copy_formats);
        self.strike_through.insert_column(column, copy_formats);
    }

    pub fn insert_row(&mut self, row: i64, copy_formats: CopyFormats) {
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
        self.render_size.insert_row(row, copy_formats);
        self.date_time.insert_row(row, copy_formats);
        self.underline.insert_row(row, copy_formats);
        self.strike_through.insert_row(row, copy_formats);
    }

    pub fn remove_column(&mut self, column: i64) -> SheetFormatUpdates {
        SheetFormatUpdates {
            align: self
                .align
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            vertical_align: self
                .vertical_align
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            wrap: self
                .wrap
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            numeric_format: self
                .numeric_format
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            numeric_decimals: self
                .numeric_decimals
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            numeric_commas: self
                .numeric_commas
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            bold: self
                .bold
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            italic: self
                .italic
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            text_color: self
                .text_color
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            fill_color: self
                .fill_color
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            render_size: self
                .render_size
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            date_time: self
                .date_time
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            underline: self
                .underline
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            strike_through: self
                .strike_through
                .remove_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
        }
    }

    pub fn copy_column(&self, column: i64) -> Option<SheetFormatUpdates> {
        let updates = SheetFormatUpdates {
            align: self
                .align
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            vertical_align: self
                .vertical_align
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            wrap: self
                .wrap
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            numeric_format: self
                .numeric_format
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            numeric_decimals: self
                .numeric_decimals
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            numeric_commas: self
                .numeric_commas
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            bold: self
                .bold
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            italic: self
                .italic
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            text_color: self
                .text_color
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            fill_color: self
                .fill_color
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            render_size: self
                .render_size
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            date_time: self
                .date_time
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            underline: self
                .underline
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            strike_through: self
                .strike_through
                .copy_column(column)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
        };
        if updates.is_default() {
            None
        } else {
            Some(updates)
        }
    }

    pub fn remove_row(&mut self, row: i64) -> SheetFormatUpdates {
        SheetFormatUpdates {
            align: self
                .align
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            vertical_align: self
                .vertical_align
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            wrap: self
                .wrap
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            numeric_format: self
                .numeric_format
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            numeric_decimals: self
                .numeric_decimals
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            numeric_commas: self
                .numeric_commas
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            bold: self
                .bold
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            italic: self
                .italic
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            text_color: self
                .text_color
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            fill_color: self
                .fill_color
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            render_size: self
                .render_size
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            date_time: self
                .date_time
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            underline: self
                .underline
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            strike_through: self
                .strike_through
                .remove_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
        }
    }

    pub fn copy_row(&self, row: i64) -> Option<SheetFormatUpdates> {
        let updates = SheetFormatUpdates {
            align: self
                .align
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            vertical_align: self
                .vertical_align
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            wrap: self
                .wrap
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            numeric_format: self
                .numeric_format
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            numeric_decimals: self
                .numeric_decimals
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            numeric_commas: self
                .numeric_commas
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            bold: self
                .bold
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            italic: self
                .italic
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            text_color: self
                .text_color
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            fill_color: self
                .fill_color
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            render_size: self
                .render_size
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            date_time: self
                .date_time
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.as_ref().map(|c| c.clone().into()))),
            underline: self
                .underline
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
            strike_through: self
                .strike_through
                .copy_row(row)
                .map(|c| c.map_ref(|c| c.map(|c| c.into()))),
        };
        if updates.is_default() {
            None
        } else {
            Some(updates)
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
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
