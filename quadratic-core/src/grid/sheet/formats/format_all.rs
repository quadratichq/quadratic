use std::collections::HashSet;

use crate::{
    controller::operations::operation::Operation,
    grid::{
        formats::{format::Format, format_update::FormatUpdate, Formats},
        CellWrap, GridBounds, Sheet,
    },
    selection::Selection,
    Pos, Rect,
};

impl Sheet {
    /// Gets the format_all for the sheet (or returns default if not set)
    pub fn format_all(&self) -> Format {
        self.format_all
            .as_ref()
            .unwrap_or(&Format::default())
            .clone()
    }

    /// Finds any format_columns that overlap with the update and return a list of column indices.
    pub(crate) fn find_overlapping_format_columns(&self, update: &FormatUpdate) -> Vec<i64> {
        self.formats_columns
            .iter()
            .filter_map(|(column, (column_format, _))| {
                if Sheet::undo_format_update(update, column_format).is_some() {
                    Some(*column)
                } else {
                    None
                }
            })
            .collect()
    }

    /// Finds any format_rows that overlap with the update and return a list of row indices.
    pub(crate) fn find_overlapping_format_rows(&self, update: &FormatUpdate) -> Vec<i64> {
        self.formats_rows
            .iter()
            .filter_map(|(row, (row_format, _))| {
                if Sheet::undo_format_update(update, row_format).is_some() {
                    Some(*row)
                } else {
                    None
                }
            })
            .collect()
    }

    /// Finds any cells that overlap with the update a return a list of positions.
    pub(crate) fn find_overlapping_format_cells(&self, update: &FormatUpdate) -> Vec<Pos> {
        self.format_selection(&Selection {
            sheet_id: self.id,
            all: true,
            ..Default::default()
        })
        .iter()
        .filter_map(|(pos, format)| {
            if Sheet::undo_format_update(update, format).is_some() {
                Some(*pos)
            } else {
                None
            }
        })
        .collect()
    }

    /// Sets the Format for all cells and returns a Vec<Operation> to undo the
    /// operation.
    ///
    /// Changing the sheet's format also removes any set formatting for columns,
    /// rows, and cells. For example, if you set everything to bold, all cells
    /// that have bold set unset bold. The undo has the reverse for these
    /// operations as well.
    ///
    /// Note: format.renderSize is not supported for format_all so we don't need
    /// to watch for changes to html cells.
    ///
    /// Returns a Vec<Operation> to undo this operation.
    pub(crate) fn set_format_all(&mut self, update: &Formats) -> (Vec<Operation>, Vec<i64>) {
        let mut old = Formats::default();
        let mut format_all = self.format_all();
        let old_wrap = format_all.wrap;

        // tracks whether we need to rerender all cells
        let mut render_cells = false;

        // tracks whether we need to change the fills
        let mut change_sheet_fills = false;
        let mut change_cell_fills = HashSet::new();

        // tracks which rows need to be resized, due to wrap text changes
        let mut resize_rows = HashSet::new();

        if let Some(format_update) = update.iter_values().next() {
            // if there are no changes to the format_all, then we don't need to
            // do anything
            if format_update.is_default() {
                return (vec![], vec![]);
            }

            if matches!(old_wrap, Some(CellWrap::Wrap))
                || matches!(format_update.wrap, Some(Some(CellWrap::Wrap)))
            {
                let bounds = self.bounds(true);
                if let GridBounds::NonEmpty(rect) = bounds {
                    resize_rows.extend(rect.y_range());
                }
            } else {
                let bounds = self.bounds(true);
                if let GridBounds::NonEmpty(rect) = bounds {
                    let rows = self.get_rows_with_wrap_in_rect(&rect);
                    resize_rows.extend(rows);
                }
            }

            // watch for changes that need to be sent to the client
            if format_update.render_cells_changed() {
                render_cells = true;
            }
            if format_update.fill_changed() {
                change_sheet_fills = true;
            }

            // change the format_all and save the old format
            old.push(format_all.merge_update_into(format_update));

            // remove the format_all if it's no longer needed
            if format_all.is_default() {
                self.format_all = None;
            } else {
                self.format_all = Some(format_all);
            }

            let mut ops = vec![];
            let selection_all = Selection {
                sheet_id: self.id,
                all: true,
                ..Default::default()
            };
            ops.push(Operation::SetCellFormatsSelection {
                selection: selection_all.clone(),
                formats: old,
            });

            let format_clear = format_update.clear_update();

            // removes all related column formatting so the all format can be applied
            let columns = self.find_overlapping_format_columns(format_update);
            if !columns.is_empty() {
                let formats = Formats::repeat(format_clear.clone(), columns.len());
                self.set_formats_columns(&columns, &formats);
                ops.push(Operation::SetCellFormatsSelection {
                    formats: Formats::repeat(format_clear.clone(), columns.len()),
                    selection: Selection {
                        sheet_id: self.id,
                        columns: Some(columns),
                        ..Default::default()
                    },
                });
            }

            // remove all related row formatting so the all format can be applied
            let rows = self.find_overlapping_format_rows(format_update);
            if !rows.is_empty() {
                let formats = Formats::repeat(format_clear.clone(), rows.len());
                self.set_formats_rows(&rows, &formats);
                ops.push(Operation::SetCellFormatsSelection {
                    formats: Formats::repeat(format_clear.clone(), rows.len()),
                    selection: Selection {
                        sheet_id: self.id,
                        rows: Some(rows),
                        ..Default::default()
                    },
                });
            }

            // removes all individual cell formatting that conflicts with the all formatting
            let cells = self.find_overlapping_format_cells(format_update);
            if !cells.is_empty() {
                let mut formats = Formats::default();
                let rects = cells
                    .iter()
                    .map(|pos| {
                        let old = self.set_format_cell(*pos, &format_clear, false);
                        if format_clear.fill_changed() {
                            change_cell_fills.insert(*pos);
                        }
                        formats.push(old);
                        Rect::single_pos(*pos)
                    })
                    .collect();
                ops.push(Operation::SetCellFormatsSelection {
                    selection: Selection {
                        sheet_id: self.id,
                        rects: Some(rects),
                        ..Default::default()
                    },
                    formats,
                });
            }

            if change_sheet_fills {
                self.send_sheet_fills();
            }

            self.send_fills(&change_cell_fills);

            // force a rerender of all impacted cells
            if render_cells {
                self.send_all_render_cells();
            }

            (ops, resize_rows.into_iter().collect())
        } else {
            // there are no updates, so nothing more to do
            (vec![], vec![])
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Pos;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn format_all() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.format_all(), Format::default());
        sheet.format_all = Some(Format {
            bold: Some(true),
            ..Default::default()
        });
        assert_eq!(
            sheet.format_all(),
            Format {
                bold: Some(true),
                ..Default::default()
            }
        );
    }

    #[test]
    #[parallel]
    fn find_overlapping_format_columns() {
        let mut sheet = Sheet::test();
        sheet.formats_columns.insert(
            0,
            (
                Format {
                    bold: Some(false),
                    ..Default::default()
                },
                0,
            ),
        );
        sheet.formats_columns.insert(
            -2,
            (
                Format {
                    bold: Some(true),
                    ..Default::default()
                },
                0,
            ),
        );

        let update = FormatUpdate {
            bold: Some(Some(true)),
            ..Default::default()
        };
        let columns = sheet.find_overlapping_format_columns(&update);
        assert_eq!(columns.len(), 2);
    }

    #[test]
    #[parallel]
    fn find_overlapping_format_rows() {
        let mut sheet = Sheet::test();
        sheet.formats_rows.insert(
            0,
            (
                Format {
                    bold: Some(false),
                    ..Default::default()
                },
                0,
            ),
        );
        sheet.formats_rows.insert(
            -2,
            (
                Format {
                    bold: Some(true),
                    ..Default::default()
                },
                0,
            ),
        );

        let update = FormatUpdate {
            bold: Some(Some(true)),
            ..Default::default()
        };
        let rows = sheet.find_overlapping_format_rows(&update);
        assert_eq!(rows.len(), 2);
    }

    #[test]
    #[parallel]
    fn find_overlapping_format_cells() {
        let mut sheet = Sheet::test();
        sheet.set_format_cell(
            Pos { x: 0, y: 0 },
            &FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            false,
        );
        sheet.set_format_cell(
            Pos { x: 1, y: 1 },
            &FormatUpdate {
                bold: Some(Some(true)),
                ..Default::default()
            },
            false,
        );
        sheet.calculate_bounds();

        let update = FormatUpdate {
            bold: Some(Some(true)),
            ..Default::default()
        };
        let cells = sheet.find_overlapping_format_cells(&update);
        assert_eq!(cells.len(), 2);
    }

    #[test]
    #[parallel]
    fn set_format_all() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            1,
        );
        let sel = Selection {
            sheet_id: sheet.id,
            all: true,
            ..Default::default()
        };
        let reverse = sheet.set_formats_selection(&sel, &formats).0;
        assert_eq!(
            sheet.format_all,
            Some(Format {
                bold: Some(true),
                ..Format::default()
            })
        );

        assert_eq!(reverse.len(), 1);
        let reverse_update = match reverse[0] {
            Operation::SetCellFormatsSelection {
                ref selection,
                ref formats,
            } => {
                assert_eq!(selection, &sel);
                assert_eq!(
                    formats.get_at(0),
                    Some(&FormatUpdate {
                        bold: Some(None),
                        ..FormatUpdate::default()
                    })
                );
                formats.get_at(0).unwrap().clone()
            }
            _ => panic!("Expected SetCellFormatsSelection"),
        };
        let formats = Formats::repeat(reverse_update, 1);
        sheet.set_formats_selection(&sel, &formats);
        assert_eq!(sheet.format_all, None);
    }

    #[test]
    #[parallel]
    fn set_format_all_remove_columns_rows() {
        let mut sheet = Sheet::test();
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
        sheet.formats_rows.insert(
            0,
            (
                Format {
                    bold: Some(false),
                    ..Default::default()
                },
                0,
            ),
        );

        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(false)),
                ..FormatUpdate::default()
            },
            1,
        );
        let sel = Selection {
            sheet_id: sheet.id,
            all: true,
            ..Default::default()
        };
        let reverse = sheet.set_formats_selection(&sel, &formats).0;
        assert_eq!(
            sheet.format_all,
            Some(Format {
                bold: Some(false),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_columns.len(), 0);
        assert_eq!(sheet.formats_rows.len(), 0);

        assert_eq!(reverse.len(), 3);
        assert_eq!(
            reverse[0],
            Operation::SetCellFormatsSelection {
                selection: Selection {
                    sheet_id: sheet.id,
                    all: true,
                    ..Default::default()
                },
                formats: Formats::repeat(
                    FormatUpdate {
                        bold: Some(None),
                        ..Default::default()
                    },
                    1
                )
            }
        );
        assert_eq!(
            reverse[1],
            Operation::SetCellFormatsSelection {
                selection: Selection {
                    sheet_id: sheet.id,
                    columns: Some(vec![0]),
                    ..Default::default()
                },
                formats: Formats::repeat(
                    FormatUpdate {
                        bold: Some(None),
                        ..Default::default()
                    },
                    1
                )
            }
        );
        assert_eq!(
            reverse[2],
            Operation::SetCellFormatsSelection {
                selection: Selection {
                    sheet_id: sheet.id,
                    rows: Some(vec![0]),
                    ..Default::default()
                },
                formats: Formats::repeat(
                    FormatUpdate {
                        bold: Some(None),
                        ..Default::default()
                    },
                    1
                )
            }
        );
    }

    #[test]
    #[parallel]
    fn set_format_all_remove_cell() {
        let mut sheet = Sheet::test();
        sheet.set_format_cell(
            Pos { x: 0, y: 0 },
            &FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
            false,
        );
        sheet.calculate_bounds();
        assert_eq!(
            sheet.format_cell(0, 0, false),
            Format {
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );

        sheet.set_format_all(&Formats::repeat(
            FormatUpdate {
                fill_color: Some(None),
                ..Default::default()
            },
            1,
        ));
        assert_eq!(sheet.format_cell(0, 0, false), Format::default());
    }
}
