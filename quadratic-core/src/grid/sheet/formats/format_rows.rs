use std::collections::HashSet;

use crate::grid::{formats::{format::Format, formats::Formats}, Sheet};

impl Sheet {
    /// Gets a format for a row, returning Format::default if not set.
    pub fn format_row(&self, row: i64) -> Format {
        self.formats_rows
            .get(&row)
            .unwrap_or(&Format::default())
            .clone()
    }

    /// Sets the Formats for rows and returns existing Formats for rows.
    pub fn set_formats_rows(&mut self, rows: &Vec<i64>, formats: &Formats) -> Formats {
        let mut old_formats = Formats::default();
        let mut formats_iter = formats.iter_values();
        let mut render_cells = HashSet::new();
        rows.iter().for_each(|y| {
            if let Some(format_update) = formats_iter.next() {
                if format_update.needs_render_cells() {
                    render_cells.insert(*y);
                }
                let mut row_format = self
                    .formats_rows
                    .get(y)
                    .unwrap_or(&Format::default())
                    .clone();
                old_formats.push(row_format.merge_update_into(format_update));
                if row_format.is_default() {
                    self.formats_rows.remove(y);
                } else {
                    self.formats_rows.insert(*y, row_format);
                }
            }
        });

        // force a rerender of all impacted cells
        if !render_cells.is_empty() {
            self.send_row_render_cells(render_cells.into_iter().collect());
        }

        old_formats
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::formats::format_update::FormatUpdate;
    use super::*;

    #[test]
    fn get_format_row() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.format_row(0), Format::default());
        sheet.formats_rows.insert(
            0,
            Format {
                bold: Some(true),
                ..Default::default()
            },
        );
        assert_eq!(
            sheet.format_row(0),
            Format {
                bold: Some(true),
                ..Default::default()
            }
        );
    }

    #[test]
    fn set_format_selection_rows() {
        todo!();
        // let mut sheet = Sheet::test();
        // let formats = Formats::repeat(
        //     FormatUpdate {
        //         bold: Some(Some(true)),
        //         ..FormatUpdate::default()
        //     },
        //     3,
        // );
        // let selection = Selection {
        //     rows: Some(vec![0, 1, 2]),
        //     ..Default::default()
        // };
        // let old_formats = sheet.set_formats_selection(&selection, &formats);
        // assert_eq!(
        //     sheet.formats_rows.get(&0),
        //     Some(&Format {
        //         bold: Some(true),
        //         ..Format::default()
        //     })
        // );
        // assert_eq!(
        //     sheet.formats_rows.get(&1),
        //     Some(&Format {
        //         bold: Some(true),
        //         ..Format::default()
        //     })
        // );
        // assert_eq!(
        //     sheet.formats_rows.get(&2),
        //     Some(&Format {
        //         bold: Some(true),
        //         ..Format::default()
        //     })
        // );
        // assert_eq!(sheet.formats_rows.get(&3), None);
        // let old_formats = sheet.set_formats_selection(&selection, &old_formats);
        // assert_eq!(sheet.formats_rows.get(&0), None);
        // assert_eq!(sheet.formats_rows.get(&1), None);
        // assert_eq!(sheet.formats_rows.get(&2), None);
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
    fn set_formats_rows() {
        let mut sheet = Sheet::test();
        let formats = Formats::repeat(
            FormatUpdate {
                bold: Some(Some(true)),
                ..FormatUpdate::default()
            },
            3,
        );
        let old_formats = sheet.set_formats_rows(&vec![0, 1, 2], &formats);
        assert_eq!(
            sheet.formats_rows.get(&0),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_rows.get(&1),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(
            sheet.formats_rows.get(&2),
            Some(&Format {
                bold: Some(true),
                ..Format::default()
            })
        );
        assert_eq!(sheet.formats_rows.get(&3), None);

        let old_formats = sheet.set_formats_rows(&vec![0, 1, 2], &old_formats);
        assert_eq!(sheet.formats_rows.get(&0), None);
        assert_eq!(sheet.formats_rows.get(&1), None);
        assert_eq!(sheet.formats_rows.get(&2), None);
        assert_eq!(
            old_formats,
            Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..FormatUpdate::default()
                },
                3
            )
        );

        assert_eq!(old_formats, formats);
    }
}