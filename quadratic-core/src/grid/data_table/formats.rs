use anyhow::Result;

use crate::{
    grid::{formats::SheetFormatUpdates, CellWrap, Format, Sheet},
    Pos, Rect,
};

use super::DataTable;

impl DataTable {
    pub fn get_format(&self, pos: Pos) -> Format {
        let pos = self.get_format_pos_from_display_buffer(pos);
        let mut format = self.formats.try_format(pos).unwrap_or_default();
        format.wrap = format.wrap.or(Some(CellWrap::Clip));
        format
    }

    pub(crate) fn get_format_pos_from_display_buffer(&self, mut pos: Pos) -> Pos {
        // adjust for hidden columns
        pos.x = self.get_column_index_from_display_index(pos.x as u32) as i64;

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
    ) -> Result<SheetFormatUpdates> {
        let mut format_update = SheetFormatUpdates::default();

        for x in formats_rect.x_range() {
            let format_display_x = u32::try_from(x - data_table_pos.x)?;
            let format_actual_x = self.get_column_index_from_display_index(format_display_x);

            for y in formats_rect.y_range() {
                let format_display_y =
                    u64::try_from(y - data_table_pos.y - self.y_adjustment(true))?;
                let format_actual_y = self.transmute_index(format_display_y);

                let format = self
                    .formats
                    .format((format_actual_x as i64 + 1, format_actual_y as i64 + 1).into());
                if !format.is_default() {
                    format_update.set_format_cell((x, y).into(), format.into());
                }
            }
        }

        Ok(format_update)
    }

    /// Create a SheetFormatUpdates object that transfers the formats from the Sheet to the DataTable.
    ///
    /// This is used when converting data on a Sheet to a DataTable.
    pub fn transfer_formats_from_sheet(
        &self,
        data_table_pos: Pos,
        sheet: &Sheet,
        formats_rect: Rect,
    ) -> Result<SheetFormatUpdates> {
        let mut format_update = SheetFormatUpdates::default();

        for x in formats_rect.x_range() {
            let format_display_x = u32::try_from(x - data_table_pos.x)?;
            let format_actual_x = self.get_column_index_from_display_index(format_display_x);

            for y in formats_rect.y_range() {
                let format_display_y =
                    u64::try_from(y - data_table_pos.y - self.y_adjustment(true))?;
                let format_actual_y = self.transmute_index(format_display_y);

                let format = sheet.formats.format((x, y).into());
                if !format.is_default() {
                    format_update.set_format_cell(
                        (format_actual_x as i64 + 1, format_actual_y as i64 + 1).into(),
                        format.into(),
                    );
                }
            }
        }

        Ok(format_update)
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
            &A1Selection::test_a1_sheet_id("E4,G5:J5", &sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

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
            &A1Selection::test_a1_sheet_id("E4,G5:J5", &sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        // first row is header
        gc.test_data_table_first_row_as_header(pos.to_sheet_pos(sheet_id), true);
        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, None);
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        assert!(data_table
            .get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0))
            .is_table_default());

        assert_eq!(sheet.cell_format(pos![G5]).bold, None);
        assert!(sheet.formats.try_format(pos![G5]).is_none());
        assert!(data_table
            .get_format(pos![G5].translate(-pos.x, -pos.y, 0, 0))
            .is_table_default());

        assert_eq!(sheet.cell_format(pos![G4]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![G4]).is_none());
        let data_table_format = data_table.get_format(pos![G4].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        assert_eq!(sheet.cell_format(pos![J5]).bold, Some(true));
        let sheet_format = sheet.formats.try_format(pos![J5]).unwrap();
        assert_eq!(sheet_format.bold, Some(true));

        // show name
        gc.test_data_table_update_meta(pos.to_sheet_pos(sheet_id), None, None, Some(false), None);

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

        assert_eq!(sheet.cell_format(pos![G4]).bold, None);
        assert!(sheet.formats.try_format(pos![G4]).is_none());
        assert!(data_table
            .get_format(pos![G4].translate(-pos.x, -pos.y, 0, 0))
            .is_table_default());

        assert_eq!(sheet.cell_format(pos![G3]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![G3]).is_none());
        let data_table_format = data_table.get_format(pos![G3].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        // show column headers
        gc.test_data_table_update_meta(pos.to_sheet_pos(sheet_id), None, None, None, Some(false));

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

        assert_eq!(sheet.cell_format(pos![G3]).bold, None);
        assert!(sheet.formats.try_format(pos![G3]).is_none());
        assert!(data_table
            .get_format(pos![G3].translate(-pos.x, -pos.y, 0, 0))
            .is_table_default());

        assert_eq!(sheet.cell_format(pos![G2]).bold, Some(true));
        assert!(sheet.formats.try_format(pos![G2]).is_none());
        let data_table_format = data_table.get_format(pos![G2].translate(-pos.x, -pos.y, 0, 0));
        assert_eq!(data_table_format.bold, Some(true));

        // first row is header
        gc.test_data_table_first_row_as_header(pos.to_sheet_pos(sheet_id), false);

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

        assert_eq!(sheet.cell_format(pos![G2]).bold, None);
        assert!(sheet.formats.try_format(pos![G2]).is_none());
        assert!(data_table
            .get_format(pos![G2].translate(-pos.x, -pos.y, 0, 0))
            .is_table_default());

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
            &A1Selection::test_a1_sheet_id("E4,G5:J5", &sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        // hide first column
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[0].display = false;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
            None,
        );

        // check formats after hiding first column
        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, None);
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        assert!(data_table
            .get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0))
            .is_table_default());

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
            &A1Selection::test_a1_sheet_id("F10,G12:J12", &sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        // check formats after adding new bold formats
        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

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
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[0].display = true;
        gc.test_data_table_update_meta(
            pos.to_sheet_pos(sheet_id),
            Some(column_headers),
            None,
            None,
            None,
        );

        // check formats after showing first column
        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

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
        assert!(data_table
            .get_format(pos![F10].translate(-pos.x, -pos.y, 0, 0))
            .is_table_default());

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
            &A1Selection::test_a1_sheet_id("E4,G5:J5", &sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

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
        let data_table = sheet.data_table_mut(pos).unwrap();
        data_table
            .sort_column(3, SortDirection::Descending)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

        assert_eq!(sheet.cell_format(pos![E4]).bold, None);
        assert!(sheet.formats.try_format(pos![E4]).is_none());
        assert!(data_table
            .get_format(pos![E4].translate(-pos.x, -pos.y, 0, 0))
            .is_table_default());

        assert_eq!(sheet.cell_format(pos![H5]).bold, None);
        assert!(sheet.formats.try_format(pos![H5]).is_none());
        assert!(data_table
            .get_format(pos![H5].translate(-pos.x, -pos.y, 0, 0))
            .is_table_default());

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
            &A1Selection::test_a1_sheet_id("E4,G5:J5", &sheet_id),
            Some(true),
            None,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

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
        let data_table = sheet.data_table_mut(pos).unwrap();
        data_table.sort_column(3, SortDirection::None).unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

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
