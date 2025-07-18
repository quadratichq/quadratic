use itertools::Itertools;

use crate::{
    CopyFormats, Pos, Rect,
    grid::{CellWrap, Format, Sheet, formats::SheetFormatUpdates},
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
        display_rect: Rect,
        sheet_format_updates: &mut SheetFormatUpdates,
    ) {
        let data_table_display_formats_update =
            self.get_display_formats_updates_for_data_table(data_table_pos, display_rect);

        let Some(data_table_display_formats_update) = data_table_display_formats_update else {
            return;
        };

        sheet_format_updates.merge(&data_table_display_formats_update);
    }

    // Factors in hidden columns and sorted rows and return SheetFormatUpdates
    // for the actual displayed formats update in sheet coordinates system
    fn get_display_formats_updates_for_data_table(
        &self,
        data_table_pos: Pos,
        display_rect: Rect,
    ) -> Option<SheetFormatUpdates> {
        let data_table_formats = self.formats.as_ref()?;

        let y_adjustment = self.y_adjustment(true);

        let data_table_rect =
            display_rect.translate(-data_table_pos.x, -data_table_pos.y - y_adjustment);

        let col_start = self
            .get_column_index_from_display_index(u32::try_from(data_table_rect.min.x).ok()?, true);
        let col_end = self
            .get_column_index_from_display_index(u32::try_from(data_table_rect.max.x).ok()?, true);

        // handle sorted rows
        let mut data_table_display_formats_update = if self.display_buffer.is_some() {
            let mut data_table_display_formats_update = SheetFormatUpdates::default();
            for y in data_table_rect.y_range() {
                if let Ok(display_row) = u64::try_from(y) {
                    let actual_row = self.get_row_index_from_display_index(display_row);

                    let mut row_formats = SheetFormatUpdates::from_sheet_formatting_rect(
                        Rect::new(
                            1 + col_start as i64,
                            1 + actual_row as i64,
                            1 + col_end as i64,
                            1 + actual_row as i64,
                        ),
                        data_table_formats,
                        false,
                    );

                    row_formats.translate_in_place(0, display_row as i64 - actual_row as i64);

                    data_table_display_formats_update.merge(&row_formats);
                }
            }
            data_table_display_formats_update
        } else {
            let data_table_formats_rect = data_table_rect.translate(1, 1);
            SheetFormatUpdates::from_sheet_formatting_rect(
                data_table_formats_rect,
                data_table_formats,
                false,
            )
        };

        // handle hidden columns
        if let Some(column_headers) = &self.column_headers {
            for column_header in column_headers
                .iter()
                .sorted_by(|a, b| b.value_index.cmp(&a.value_index))
            {
                if !column_header.display {
                    data_table_display_formats_update
                        .remove_column(column_header.value_index as i64 + 1);
                }
            }
        }

        if data_table_display_formats_update.is_default() {
            None
        } else {
            data_table_display_formats_update
                .translate_in_place(data_table_pos.x - 1, data_table_pos.y + y_adjustment - 1);
            Some(data_table_display_formats_update)
        }
    }

    /// Create a SheetFormatUpdates object that transfers the formats from the Sheet to the DataTable.
    ///
    /// This is used when converting data on a Sheet to a DataTable.
    pub fn transfer_formats_from_sheet(
        &self,
        data_table_pos: Pos,
        display_rect: Rect,
        sheet: &Sheet,
    ) -> Option<SheetFormatUpdates> {
        if sheet.formats.is_all_default() {
            return None;
        }

        let mut format_update =
            SheetFormatUpdates::from_sheet_formatting_rect(display_rect, &sheet.formats, false);

        if format_update.is_default() {
            return None;
        }

        self.adjust_format_update_for_hidden_sorted_rows(
            data_table_pos,
            display_rect,
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
        display_rect: Rect,
        sheet_format_updates: &mut SheetFormatUpdates,
    ) -> Option<SheetFormatUpdates> {
        if sheet_format_updates.is_default() {
            return None;
        }

        let mut data_table_format_update = SheetFormatUpdates::default();

        data_table_format_update
            .transfer_format_rect_from_other(display_rect, sheet_format_updates);

        if data_table_format_update.is_default() {
            return None;
        }

        self.adjust_format_update_for_hidden_sorted_rows(
            data_table_pos,
            display_rect,
            &mut data_table_format_update,
        );

        if data_table_format_update.is_default() {
            None
        } else {
            Some(data_table_format_update)
        }
    }

    /// Adjusts the SheetFormatUpdates for hidden columns and sorted rows.
    fn adjust_format_update_for_hidden_sorted_rows(
        &self,
        data_table_pos: Pos,
        display_rect: Rect,
        data_table_format_update: &mut SheetFormatUpdates,
    ) {
        let y_adjustment = self.y_adjustment(true);

        let data_table_rect =
            display_rect.translate(-data_table_pos.x, -data_table_pos.y - y_adjustment);

        data_table_format_update
            .translate_in_place(1 - data_table_pos.x, 1 - data_table_pos.y - y_adjustment);

        // handle sorted rows
        if self.display_buffer.is_some() {
            let mut rows_formats = vec![];

            for y in data_table_rect.y_range() {
                if let Ok(display_row) = u64::try_from(y) {
                    let actual_row = self.get_row_index_from_display_index(display_row);

                    if let Some(mut row_formats) =
                        data_table_format_update.copy_row(display_row as i64 + 1)
                    {
                        row_formats.translate_in_place(0, actual_row as i64 - display_row as i64);

                        rows_formats.push((actual_row, row_formats));
                    }
                }
            }

            let mut sorted_formats_update = SheetFormatUpdates::default();

            rows_formats.sort_by_key(|(actual_row, _)| *actual_row);
            for (_, row_formats) in rows_formats {
                sorted_formats_update.merge(&row_formats);
            }

            std::mem::swap(data_table_format_update, &mut sorted_formats_update);
        }

        // handle hidden columns
        if let Some(column_headers) = &self.column_headers {
            for column_header in column_headers
                .iter()
                .sorted_by_key(|column_header| column_header.value_index)
            {
                if !column_header.display {
                    data_table_format_update
                        .insert_column(column_header.value_index as i64 + 1, CopyFormats::None);
                }
            }
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
