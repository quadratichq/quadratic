use chrono::Utc;

use crate::{
    controller::operations::operation::Operation,
    grid::{
        formats::{format::Format, format_update::FormatUpdate, Formats},
        CellWrap, Sheet,
    },
    selection::OldSelection,
    Pos, Rect,
};
use std::collections::{HashMap, HashSet};

impl Sheet {
    /// Gets a format for a column, returning Format::default if not set.
    pub fn format_column(&self, column: i64) -> Format {
        self.formats_columns
            .get(&column)
            .map_or(Format::default(), |f| f.0.clone())
    }

    /// Tries to get a format for a column, returning None if not set.
    pub fn try_format_column(&self, column: i64) -> Option<Format> {
        self.formats_columns.get(&column).map(|f| f.0.clone())
    }

    /// Sets the Formats for columns and returns existing Formats for columns.
    ///
    /// Changing the column's format also removes any set formatting for cells
    /// within that column. For example, if you set a column to bold, all cells
    /// that have bold set within that column will remove their bold setting.
    /// The undo has the reverse for these operations as well as the column
    /// undo.
    ///
    /// Note, changing format.renderSize is not supported on columns so we don't
    /// need to update html cells.
    ///
    /// Returns the reverse operations.
    pub(crate) fn set_formats_columns(
        &mut self,
        columns: &[i64],
        formats: &Formats,
    ) -> (Vec<Operation>, HashSet<Pos>, HashSet<i64>) {
        let mut old_formats = Formats::default();
        let mut formats_iter = formats.iter_values();

        // tracks which hashes than need to be updated
        let mut dirty_hashes = HashSet::new();

        // tracks whether we need to update fills for the column
        let mut render_column_fills = false;

        // tracks whether we need to update fills for the cells
        let mut render_fills = HashSet::new();

        // tracks which rows need to be resized, due to wrap text changes
        let mut resize_rows = HashSet::new();

        // individual cells that need to be cleared to accommodate the new column format
        let mut clear_format_cells: HashMap<Pos, FormatUpdate> = HashMap::new();

        columns.iter().for_each(|x| {
            // gets the format change for this column
            if let Some(format_update) = formats_iter.next() {
                // don't need to do anything if there are no changes
                if !format_update.is_default() {
                    if format_update.render_cells_changed() {
                        if let Some((start, end)) = self.column_bounds(*x, true) {
                            for row in start..=end {
                                let pos = Pos { x: *x, y: row };
                                let (x, y) = pos.quadrant();
                                dirty_hashes.insert(Pos { x, y });
                            }
                        }
                    }

                    if format_update.fill_changed() {
                        render_column_fills = true;
                    }

                    // update the column format and save the old format
                    let mut column_format = self.format_column(*x);
                    let old_wrap = column_format.wrap;
                    old_formats.push(column_format.merge_update_into(format_update));

                    // remove the column format if it's no longer needed
                    if column_format.is_default() {
                        self.formats_columns.remove(x);
                    } else {
                        self.formats_columns
                            .insert(*x, (column_format, Utc::now().timestamp()));
                    }

                    // track all cells within the columns that need to have
                    // their format updated to remove the conflicting format
                    self.format_selection(&OldSelection {
                        sheet_id: self.id,
                        columns: Some(vec![*x]),
                        ..Default::default()
                    })
                    .iter()
                    .for_each(|(pos, format)| {
                        if let Some(clear) =
                            format.needs_to_clear_cell_format_for_parent(format_update)
                        {
                            if clear.fill_changed() {
                                render_fills.insert(*pos);
                            }
                            if let Some(existing) = clear_format_cells.get_mut(pos) {
                                existing.combine(&clear);
                            } else {
                                clear_format_cells.insert(*pos, clear);
                            }
                        }
                    });

                    if matches!(old_wrap, Some(CellWrap::Wrap))
                        || matches!(format_update.wrap, Some(Some(CellWrap::Wrap)))
                    {
                        if let Some((start, end)) = self.column_bounds(*x, true) {
                            resize_rows.extend(start..=end);
                        }
                    } else {
                        let rows = self.get_rows_with_wrap_in_column(*x);
                        resize_rows.extend(rows);
                    }
                }
            }
        });

        // adds operations to revert changes to the columns
        let mut ops = vec![];
        ops.push(Operation::SetCellFormatsSelection {
            selection: OldSelection {
                sheet_id: self.id,
                columns: Some(columns.to_vec()),
                ..Default::default()
            },
            formats: old_formats,
        });

        // changes individual cells and adds operations to revert changes to the
        // cells impacted by the changes to the columns
        if !clear_format_cells.is_empty() {
            let mut rects = vec![];
            let mut formats = Formats::default();
            for (pos, update) in clear_format_cells.iter() {
                let old = self.set_format_cell(*pos, update, false);
                rects.push(Rect::single_pos(*pos));
                formats.push(old);
            }
            ops.push(Operation::SetCellFormatsSelection {
                selection: OldSelection {
                    sheet_id: self.id,
                    rects: Some(rects),
                    ..Default::default()
                },
                formats,
            });
        }

        // force a rerender of all column, row, and sheet fills
        if render_column_fills {
            self.send_sheet_fills();
        }

        // send any update cell fills
        if !render_fills.is_empty() {
            self.send_fills(&render_fills);
        }

        (ops, dirty_hashes, resize_rows)
    }
}

#[cfg(test)]
mod tests {
    use serial_test::{parallel, serial};

    use super::*;
    use crate::{grid::formats::format_update::FormatUpdate, wasm_bindings::js::expect_js_call};

    #[test]
    #[parallel]
    fn format_column() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.format_column(0), Format::default());
        sheet.formats_columns.insert(
            0,
            (
                Format {
                    bold: Some(true),
                    ..Default::default()
                },
                0,
            ),
        );
        assert_eq!(
            sheet.format_column(0),
            Format {
                bold: Some(true),
                ..Default::default()
            }
        );
    }

    #[test]
    #[parallel]
    fn try_format_column() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.try_format_column(0), None);
        sheet.formats_columns.insert(
            0,
            (
                Format {
                    bold: Some(true),
                    ..Default::default()
                },
                0,
            ),
        );
        assert_eq!(
            sheet.try_format_column(0),
            Some(Format {
                bold: Some(true),
                ..Default::default()
            })
        );
    }

    #[test]
    #[parallel]
    fn set_format_columns() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let columns = vec![0, 1, 2];
        let reverse = sheet.set_formats_columns(&columns, &formats).0;
        assert_eq!(
            sheet.format_column(0),
            Format {
                bold: Some(true),
                ..Format::default()
            }
        );
        assert_eq!(
            sheet.format_column(1),
            Format {
                bold: Some(true),
                ..Format::default()
            }
        );
        assert_eq!(
            sheet.format_column(2),
            Format {
                bold: Some(true),
                ..Format::default()
            }
        );
        assert_eq!(sheet.formats_columns.get(&3), None);

        assert_eq!(reverse.len(), 1);
        let reverse_formats = match reverse[0] {
            Operation::SetCellFormatsSelection {
                ref formats,
                ref selection,
            } => {
                assert_eq!(
                    selection,
                    &OldSelection {
                        sheet_id: sheet.id,
                        columns: Some(columns.clone()),
                        ..Default::default()
                    }
                );
                assert_eq!(
                    formats,
                    &Formats::repeat(
                        FormatUpdate {
                            bold: Some(None),
                            ..FormatUpdate::default()
                        },
                        3
                    )
                );
                formats.clone()
            }
            _ => panic!("Expected SetCellFormatsSelection"),
        };
        sheet.set_formats_columns(&columns, &reverse_formats);
        assert_eq!(sheet.formats_columns.get(&0), None);
        assert_eq!(sheet.formats_columns.get(&1), None);
        assert_eq!(sheet.formats_columns.get(&2), None);
    }

    #[test]
    #[parallel]
    fn set_format_columns_remove_cell_formatting() {
        let mut sheet = Sheet::test();
        sheet.test_set_format(
            0,
            0,
            FormatUpdate {
                bold: Some(Some(false)),
                ..Default::default()
            },
        );
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let columns = vec![0, 1, 2];
        let reverse = sheet.set_formats_columns(&columns, &formats).0;
        assert_eq!(sheet.format_cell(0, 0, false), Format::default());
        assert_eq!(sheet.format_column(0).bold, Some(true));
        assert_eq!(reverse.len(), 2);

        let (reverse_selection, reverse_formats) = match reverse[1] {
            Operation::SetCellFormatsSelection {
                ref formats,
                ref selection,
            } => {
                assert_eq!(
                    selection,
                    &OldSelection {
                        sheet_id: sheet.id,
                        rects: Some(vec![Rect::single_pos(Pos { x: 0, y: 0 })]),
                        ..Default::default()
                    }
                );
                assert_eq!(
                    formats,
                    &Formats::repeat(
                        FormatUpdate {
                            bold: Some(Some(false)),
                            ..FormatUpdate::default()
                        },
                        1
                    )
                );
                (selection.clone(), formats.clone())
            }
            _ => panic!("Expected SetCellFormatsSelection"),
        };
        sheet.set_formats_selection(&reverse_selection, &reverse_formats);
        assert_eq!(
            sheet.format_cell(0, 0, false),
            Format {
                bold: Some(false),
                ..Default::default()
            }
        );
    }

    #[test]
    #[serial]
    fn set_format_columns_fills() {
        let mut sheet = Sheet::test();
        sheet.test_set_format(
            0,
            0,
            FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
        );
        sheet.calculate_bounds();
        assert_eq!(
            sheet.format_cell(0, 0, false).fill_color,
            Some("red".to_string())
        );

        let reverse = sheet
            .set_formats_columns(
                &[0],
                &Formats::repeat(
                    FormatUpdate {
                        fill_color: Some(Some("blue".to_string())),
                        ..FormatUpdate::default()
                    },
                    1,
                ),
            )
            .0;

        // cell format is cleared because of the column format change
        assert_eq!(sheet.format_cell(0, 0, false).fill_color, None);

        // ensure fills are sent to the client
        let meta_fills = sheet.get_sheet_fills();
        expect_js_call(
            "jsSheetMetaFills",
            format!(
                "{},{}",
                sheet.id,
                serde_json::to_string(&meta_fills).unwrap()
            ),
            false,
        );
        let fills = sheet.get_all_render_fills();
        expect_js_call(
            "jsSheetFills",
            format!("{},{}", sheet.id, serde_json::to_string(&fills).unwrap()),
            true,
        );

        assert_eq!(reverse.len(), 2);
    }

    #[test]
    #[parallel]
    fn timestamp() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let columns = vec![0, 1, 2];
        let reverse = sheet.set_formats_columns(&columns, &formats).0;
        assert_eq!(
            sheet.formats_columns.get(&0).unwrap().1,
            sheet.formats_columns.get(&1).unwrap().1
        );
        assert_eq!(
            sheet.formats_columns.get(&1).unwrap().1,
            sheet.formats_columns.get(&2).unwrap().1
        );
        assert_eq!(reverse.len(), 1);
    }

    #[test]
    #[parallel]
    fn cleared() {
        let mut sheet = Sheet::test();
        sheet.set_formats_columns(
            &[0],
            &Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..Default::default()
                },
                1,
            ),
        );
        sheet.set_formats_columns(
            &[1],
            &Formats::repeat(
                FormatUpdate {
                    fill_color: Some(Some("red".to_string())),
                    ..Default::default()
                },
                1,
            ),
        );
        sheet.set_formats_columns(
            &[2],
            &Formats::repeat(
                FormatUpdate {
                    text_color: Some(Some("blue".to_string())),
                    ..Default::default()
                },
                1,
            ),
        );
        let formats = Formats::repeat(FormatUpdate::cleared(), 3);
        let columns = vec![0, 1, 2];
        let reverse = sheet.set_formats_columns(&columns, &formats).0;
        assert_eq!(sheet.format_column(0), Format::default());
        assert_eq!(sheet.format_column(1), Format::default());
        assert_eq!(sheet.format_column(2), Format::default());
        assert_eq!(sheet.formats_columns.len(), 0);
        assert_eq!(reverse.len(), 1);
    }
}
