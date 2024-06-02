use std::collections::{HashMap, HashSet};
use crate::{controller::operations::operation::Operation, grid::{formats::{format::Format, format_update::FormatUpdate, formats::Formats}, Sheet}, selection::Selection, Pos, Rect};

impl Sheet {
  /// Gets a format for a column, returning Format::default if not set.
    pub fn format_column(&self, column: i64) -> Format {
        self.formats_columns
            .get(&column)
            .unwrap_or(&Format::default())
            .clone()
    }

    /// Sets the Formats for columns and returns existing Formats for columns.
    ///
    /// Changing the column's format also removes any set formatting for the
    /// entire grid. For example, if you set everything to bold, all cells that
    /// have bold set unset bold. The undo has the reverse for these operations
    /// as well.
    ///
    /// Returns the reverse operations.
    pub fn set_formats_columns(&mut self, columns: &Vec<i64>, formats: &Formats) -> Vec<Operation> {
        let mut old_formats = Formats::default();
        let mut formats_iter = formats.iter_values();
        let mut render_cells = HashSet::new();

        // individual cells that need to be cleared
        let mut clear_format_cells: HashMap<Pos, FormatUpdate> = HashMap::new();

        columns.iter().for_each(|x| {
            if let Some(format_update) = formats_iter.next() {
                if !format_update.is_default() {
                    if format_update.needs_render_cells() {
                        render_cells.insert(*x);
                    }

                    // update the column format and save the old format
                    let mut column_format = self.format_column(*x);
                    old_formats.push(column_format.merge_update_into(format_update));
                    if column_format.is_default() {
                        self.formats_columns.remove(x);
                    } else {
                        self.formats_columns.insert(*x, column_format);
                    }

                    // track all cells within the columns that have the format set
                    self.format_selection(&Selection { columns: Some(vec![*x]), ..Default::default() }).iter().for_each(|(pos, format)| {
                        if let Some(clear) = format.needs_to_clear_cell_format_for_parent(&format_update) {
                            if let Some(existing) = clear_format_cells.get_mut(pos) {
                                existing.combine(&clear);
                            } else {
                                clear_format_cells.insert(*pos, clear);
                            }
                        }
                    });
                }
            }
        });

        // adds operations to revert changes to the columns
        let mut ops = vec![];
        ops.push(Operation::SetCellFormatsSelection { selection: Selection { columns: Some(columns.clone()), ..Default::default() }, formats: old_formats });


        // changes individual cells and adds operations to revert changes to the
        // cells impacted by the changes to the columns
        if !clear_format_cells.is_empty() {
            let mut rects = vec![];
            let mut formats = Formats::default();
            for (pos, update) in clear_format_cells.iter() {
                rects.push(Rect::single_pos(*pos));
                formats.push(update.clone());
            }
            ops.push(Operation::SetCellFormatsSelection { selection: Selection { rects: Some(rects), ..Default::default() }, formats });
        }


        // force a rerender of all impacted cells
        if !render_cells.is_empty() {
            self.send_column_render_cells(render_cells.into_iter().collect());
        }

        ops
    }
  }

#[cfg(test)]
mod tests {
    use crate::grid::formats::format_update::FormatUpdate;
    use super::*;

    #[test]
    fn get_format_column() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.format_column(0), Format::default());
        sheet.formats_columns.insert(
            0,
            Format {
                bold: Some(true),
                ..Default::default()
            },
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
    fn set_format_selection_columns() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let selection = Selection {
            columns: Some(vec![0, 1, 2]),
            ..Default::default()
        };
        let undo = sheet.set_formats_selection(&selection, &formats);
        assert_eq!(undo.len(), 2);
        assert_eq!(
            sheet.formats_columns.get(&0),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&1),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&2),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_columns.get(&3), None);

        todo!();
        // let reverse = sheet.set_formats_selection(&selection, &old_formats);
        // assert_eq!(sheet.formats_columns.get(&0), None);
        // assert_eq!(sheet.formats_columns.get(&1), None);
        // assert_eq!(sheet.formats_columns.get(&2), None);
        // assert_eq!(
        //     old_formats,
        //     Formats::repeat(
        //         FormatUpdate {
        //             bold: Some(Some(true)),
        //             ..FormatUpdate::default()
        //         },
        //         3
        //     )
        // );

        // assert_eq!(old_formats, formats);
    }

    #[test]
    fn set_format_columns() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let undo = sheet.set_formats_columns(&vec![0, 1, 2], &formats);
        assert_eq!(undo.len(), 2);
        assert_eq!(
            sheet.formats_columns.get(&0),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&1),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_columns.get(&2),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_columns.get(&3), None);

        // let undo = sheet.set_formats_columns(&vec![0, 1, 2], &old_formats);
        // assert_eq!(sheet.formats_columns.get(&0), None);
        // assert_eq!(sheet.formats_columns.get(&1), None);
        // assert_eq!(sheet.formats_columns.get(&2), None);
        // assert_eq!(
        //     old_formats,
        //     Formats::repeat(
        //         FormatUpdate {
        //             bold: Some(Some(true)),
        //             ..FormatUpdate::default()
        //         },
        //         3
        //     )
        // );

        // assert_eq!(old_formats, formats);
    }
}