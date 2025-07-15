use itertools::Itertools;

use crate::{
    CopyFormats, Pos, Rect,
    grid::{CellWrap, Format, Sheet, SheetFormatting, formats::SheetFormatUpdates},
};

use super::DataTable;

impl DataTable {
    /// Returns the cell format for a relative position within the data table.
    /// 0,0 is the top left.
    ///
    /// This is expensive for multiple cell queries, used for single cell queries only.
    pub fn get_format(&self, pos: Pos) -> Format {
        let pos = self.get_format_pos_from_display_pos(pos);
        let mut format = self
            .formats
            .as_ref()
            .and_then(|format| format.try_format(pos))
            .unwrap_or_default();
        format.wrap = format.wrap.or(Some(CellWrap::Clip));
        format
    }

    /// Get the position of the format for the input display position within the data table.
    fn get_format_pos_from_display_pos(&self, mut pos: Pos) -> Pos {
        // adjust for hidden columns
        pos.x = self.get_column_index_from_display_index(pos.x as u32, true) as i64;

        // adjust for first row header and show ui offset
        pos.y -= self.y_adjustment(true);

        match &self.display_buffer {
            Some(display_buffer) => {
                if pos.y >= 0 && pos.y < display_buffer.len() as i64 {
                    pos.y = display_buffer[pos.y as usize] as i64;
                }
                // translate to 1-based pos, required for formats
                pos.translate(1, 1, 1, 1)
            }

            None => {
                // translate to 1-based pos, required for formats
                pos.translate(1, 1, 1, 1)
            }
        }
    }

    /// Create a SheetFormatUpdates object that transfers the formats from the DataTable to the Sheet.
    ///
    /// This is used when flattening a DataTable, or part of it, to a Sheet.
    pub fn transfer_formats_to_sheet(
        &self,
        data_table_pos: Pos,
        formats_rect: Rect,
        sheet_format_updates: &mut SheetFormatUpdates,
    ) {
        let data_table_display_formats = self.get_display_formats_for_data_table(data_table_pos);
        let Some(data_table_display_formats) = data_table_display_formats else {
            return;
        };

        let data_table_format_updates = SheetFormatUpdates::from_sheet_formatting_rect(
            formats_rect,
            &data_table_display_formats,
            false,
        );

        sheet_format_updates.merge(&data_table_format_updates);
    }

    // Factors in hidden columns and sorted rows and return SheetFormatting
    // for the actual displayed formats in sheet coordinates system
    //
    // This is expensive for single cell queries, used for rect queries only
    fn get_display_formats_for_data_table(&self, data_table_pos: Pos) -> Option<SheetFormatting> {
        let mut formats = self.formats.clone()?;

        // handle hidden columns
        if let Some(column_headers) = &self.column_headers {
            for column_header in column_headers
                .iter()
                .sorted_by(|a, b| b.value_index.cmp(&a.value_index))
            {
                if !column_header.display {
                    formats.remove_column(column_header.value_index as i64 + 1);
                }
            }
        }

        // handle sorted rows
        if let Some(display_buffer) = &self.display_buffer {
            let mut sorted_formats = SheetFormatting::default();
            for (display_row, &actual_row) in display_buffer
                .iter()
                .enumerate()
                .sorted_by_key(|(display_row, _)| *display_row)
            {
                if let Some(mut row_formats) = formats.copy_row(actual_row as i64 + 1) {
                    row_formats.translate_in_place(0, display_row as i64 - actual_row as i64);
                    sorted_formats.apply_updates(&row_formats);
                }
            }
            std::mem::swap(&mut formats, &mut sorted_formats);
        }

        // convert to sheet coordinates
        let y_adjustment = self.y_adjustment(true);
        formats.translate_in_place(data_table_pos.x - 1, data_table_pos.y - 1 + y_adjustment);

        if formats.is_all_default() {
            None
        } else {
            Some(formats)
        }
    }

    /// Create a SheetFormatUpdates object that transfers the formats from the Sheet to the DataTable.
    ///
    /// This is used when converting data on a Sheet to a DataTable.
    pub fn transfer_formats_from_sheet(
        &self,
        data_table_pos: Pos,
        formats_rect: Rect,
        sheet: &Sheet,
    ) -> Option<SheetFormatUpdates> {
        if sheet.formats.is_all_default() {
            return None;
        }

        let mut format_update =
            SheetFormatUpdates::from_sheet_formatting_rect(formats_rect, &sheet.formats, false);

        if format_update.is_default() {
            return None;
        }

        self.adjust_format_update_for_hidden_sorted_rows(
            data_table_pos,
            formats_rect,
            &mut format_update,
        );

        if format_update.is_default() {
            None
        } else {
            Some(format_update)
        }
    }

    /// Transfers the formats from a SheetFormatUpdates into the DataTable.
    pub fn transfer_formats_from_sheet_format_updates(
        &self,
        data_table_pos: Pos,
        formats_rect: Rect,
        sheet_format_updates: &mut SheetFormatUpdates,
    ) -> Option<SheetFormatUpdates> {
        if sheet_format_updates.is_default() {
            return None;
        }

        let mut format_update = SheetFormatUpdates::default();

        format_update.transfer_format_rect_from_other(formats_rect, sheet_format_updates);

        if format_update.is_default() {
            return None;
        }

        self.adjust_format_update_for_hidden_sorted_rows(
            data_table_pos,
            formats_rect,
            &mut format_update,
        );

        if format_update.is_default() {
            None
        } else {
            Some(format_update)
        }
    }

    /// Adjusts the SheetFormatUpdates for hidden columns and sorted rows.
    fn adjust_format_update_for_hidden_sorted_rows(
        &self,
        data_table_pos: Pos,
        formats_rect: Rect,
        format_update: &mut SheetFormatUpdates,
    ) {
        let y_adjustment = self.y_adjustment(true);

        format_update.translate_in_place(1 - data_table_pos.x, 1 - data_table_pos.y - y_adjustment);

        // handle hidden columns
        if let Some(column_headers) = &self.column_headers {
            for column_header in column_headers
                .iter()
                .sorted_by_key(|column_header| column_header.value_index)
            {
                if !column_header.display {
                    format_update
                        .insert_column(column_header.value_index as i64 + 1, CopyFormats::None);
                }
            }
        }

        // handle sorted rows
        if let Some(display_buffer) = &self.display_buffer {
            let mut sorted_formats_update = SheetFormatUpdates::default();

            let mut max_row = 1;

            for (display_row, &actual_row) in display_buffer
                .iter()
                .enumerate()
                .sorted_by_key(|(_, actual_row)| *actual_row)
            {
                if let Some(mut row_formats) = format_update.copy_row(display_row as i64 + 1) {
                    if !row_formats.is_default() {
                        row_formats.translate_in_place(0, actual_row as i64 - display_row as i64);
                        sorted_formats_update.merge(&row_formats);
                    }
                }
                max_row = max_row.max(display_row as i64);
            }

            let max_y = formats_rect.max.y + 1 - data_table_pos.y - y_adjustment;

            for display_row in (max_row + 1)..=max_y {
                if let Some(row_formats) = format_update.copy_row(display_row + 1) {
                    if !row_formats.is_default() {
                        sorted_formats_update.merge(&row_formats);
                    }
                }
            }

            std::mem::swap(format_update, &mut sorted_formats_update);
        }
    }
}

#[cfg(test)]
pub mod test {
    use crate::{
        a1::A1Selection, controller::user_actions::import::tests::simple_csv_at,
        grid::sort::SortDirection,
    };

    #[test]
    fn test_try_format_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        gc.test_data_table_first_row_as_header(pos.to_sheet_pos(sheet_id), false);

        gc.set_bold(
            &A1Selection::test_a1_sheet_id("E4,G5:J5", sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        let data_table_format = data_table.get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![G5]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![G5]).is_none());
        let data_table_format = data_table.get_format(pos![G5].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![J5]).bold, Some(true));
        let sheet_format = sheet.formats.try_format(pos![J5]).unwrap();
        assert_eq!(sheet_format.bold, Some(true));
    }

    #[test]
    fn test_try_format_data_table_first_row_header_and_show_ui() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        gc.test_data_table_first_row_as_header(pos.to_sheet_pos(sheet_id), false);

        gc.set_bold(
            &A1Selection::test_a1_sheet_id("E4,G5:J5", sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        // first row is header
        gc.test_data_table_first_row_as_header(pos.to_sheet_pos(sheet_id), true);
        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, None);
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        assert!(
            data_table
                .get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0))
                .is_table_default()
        );

        assert_eq!(sheet.cell_format(pos![G5]).bold, None);
        assert!(sheet.formats.try_format(pos![G5]).is_none());
        assert!(
            data_table
                .get_format(pos![G5].translate(-pos.x, -pos.y, 0, 0))
                .is_table_default()
        );

        assert_eq!(sheet.cell_format(pos![G4]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![G4]).is_none());
        let data_table_format = data_table.get_format(pos![G4].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![J5]).bold, Some(true));
        let sheet_format = sheet.formats.try_format(pos![J5]).unwrap();
        assert_eq!(sheet_format.bold, Some(true));

        // show name
        gc.test_data_table_update_meta(pos.to_sheet_pos(sheet_id), None, Some(false), None);

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![G4]).bold, None);
        assert!(sheet.formats.try_format(pos![G4]).is_none());
        assert!(
            data_table
                .get_format(pos![G4].translate(-pos.x, -pos.y, 0, 0))
                .is_table_default()
        );

        assert_eq!(sheet.cell_format(pos![G3]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![G3]).is_none());
        let data_table_format = data_table.get_format(pos![G3].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        // show column headers
        gc.test_data_table_update_meta(pos.to_sheet_pos(sheet_id), None, None, Some(false));

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![G3]).bold, None);
        assert!(sheet.formats.try_format(pos![G3]).is_none());
        assert!(
            data_table
                .get_format(pos![G3].translate(-pos.x, -pos.y, 0, 0))
                .is_table_default()
        );

        assert_eq!(sheet.cell_format(pos![G2]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![G2]).is_none());
        let data_table_format = data_table.get_format(pos![G2].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        // first row is header
        gc.test_data_table_first_row_as_header(pos.to_sheet_pos(sheet_id), false);

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![G2]).bold, None);
        assert!(sheet.formats.try_format(pos![G2]).is_none());
        assert!(
            data_table
                .get_format(pos![G2].translate(-pos.x, -pos.y, 0, 0))
                .is_table_default()
        );

        assert_eq!(sheet.cell_format(pos![G3]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![G3]).is_none());
        let data_table_format = data_table.get_format(pos![G3].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![E2]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![E2]).is_none());
        let data_table_format = data_table.get_format(pos![E2].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));
    }

    #[test]
    fn test_try_format_data_table_with_hidden_column() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        gc.test_data_table_first_row_as_header(pos.to_sheet_pos(sheet_id), false);

        gc.set_bold(
            &A1Selection::test_a1_sheet_id("E4,G5:J5", sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        // hide first column
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[0].display = false;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
        );

        // check formats after hiding first column
        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, None);
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        assert!(
            data_table
                .get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0))
                .is_table_default()
        );

        assert_eq!(sheet.cell_format(pos![F5]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![F5]).is_none());
        let data_table_format = data_table.get_format(pos![F5].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![H5]).bold, None);
        assert!(sheet.formats.try_format(pos![H5]).is_none());

        assert_eq!(sheet.cell_format(pos![J5]).bold, Some(true));
        let sheet_format = sheet.formats.try_format(pos![J5]).unwrap();
        assert_eq!(sheet_format.bold, Some(true));

        // add new bold formats with first column hidden
        gc.test_data_table_first_row_as_header(pos.to_sheet_pos(sheet_id), false);
        gc.set_bold(
            &A1Selection::test_a1_sheet_id("F10,G12:J12", sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        // check formats after adding new bold formats
        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![F10]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![F10]).is_none());
        let data_table_format = data_table.get_format(pos![F10].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![G12]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![G12]).is_none());
        let data_table_format = data_table.get_format(pos![G12].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![J12]).bold, Some(true));
        let sheet_format = sheet.formats.try_format(pos![J12]).unwrap();
        assert_eq!(sheet_format.bold, Some(true));

        // show first column
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[0].display = true;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
        );

        // check formats after showing first column
        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        let data_table_format = data_table.get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![H5]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![H5]).is_none());
        let data_table_format = data_table.get_format(pos![H5].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![F10]).bold, None);
        assert!(sheet.formats.try_format(pos![F10]).is_none());
        assert!(
            data_table
                .get_format(pos![F10].translate(-pos.x, -pos.y, 0, 0))
                .is_table_default()
        );

        assert_eq!(sheet.cell_format(pos![H12]).bold, Some(true));
        let sheet_format = sheet.formats.try_format(pos![H12]).unwrap();
        assert_eq!(sheet_format.bold, Some(true));
        let data_table_format = data_table.get_format(pos![H12].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));
    }

    #[test]
    fn test_try_format_data_table_with_sort() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        gc.set_bold(
            &A1Selection::test_a1_sheet_id("E4,G5:J5", sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        let data_table_format = data_table.get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![H5]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![H5]).is_none());
        let data_table_format = data_table.get_format(pos![H5].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        // sort column 3 descending
        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&pos, |dt| {
                dt.sort_column(3, SortDirection::Descending).unwrap();
                Ok(())
            })
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, None);
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        assert!(
            data_table
                .get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0))
                .is_table_default()
        );

        assert_eq!(sheet.cell_format(pos![H5]).bold, None);
        assert!(sheet.formats.try_format(pos![H5]).is_none());
        assert!(
            data_table
                .get_format(pos![H5].translate(-pos.x, -pos.y, 0, 0))
                .is_table_default()
        );

        assert_eq!(sheet.cell_format(pos![E13]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![E13]).is_none());
        let data_table_format = data_table.get_format(pos![E13].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![H12]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![H12]).is_none());
        let data_table_format = data_table.get_format(pos![H12].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        // add new bold formats with sort
        gc.set_bold(
            &A1Selection::test_a1_sheet_id("E4,G5:J5", sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        let data_table_format = data_table.get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![H5]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![H5]).is_none());
        let data_table_format = data_table.get_format(pos![H5].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![E13]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![E13]).is_none());
        let data_table_format = data_table.get_format(pos![E13].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![H12]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![H12]).is_none());
        let data_table_format = data_table.get_format(pos![H12].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        // remove sort
        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&pos, |dt| {
                dt.sort_column(3, SortDirection::None).unwrap();
                Ok(())
            })
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        let data_table_format = data_table.get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![H5]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![H5]).is_none());
        let data_table_format = data_table.get_format(pos![H5].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![E8]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![E8]).is_none());
        let data_table_format = data_table.get_format(pos![E8].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![H9]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![H9]).is_none());
        let data_table_format = data_table.get_format(pos![H9].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));
    }
}
