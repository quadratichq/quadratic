use super::Sheet;
use crate::{
    controller::operations::{
        clipboard::{ClipboardOrigin, ClipboardSheetFormats},
        operation::Operation,
    },
    grid::formats::{format::Format, format_update::FormatUpdate, Formats},
    selection::Selection,
    Pos,
};
use std::collections::{HashMap, HashSet};

pub mod format_all;
pub mod format_cell;
pub mod format_columns;
pub mod format_rects;
pub mod format_rows;

impl Sheet {
    /// This returns a FormatUpdate to undo a change to Format from a FormatUpdate.
    pub(crate) fn undo_format_update(
        update: &FormatUpdate,
        format: &Format,
    ) -> Option<FormatUpdate> {
        let mut undo = FormatUpdate::default();
        if update.align.is_some() {
            undo.align = Some(format.align);
        }
        if update.wrap.is_some() {
            undo.wrap = Some(format.wrap);
        }
        if update.numeric_format.is_some() {
            undo.numeric_format = Some(format.numeric_format.clone());
        }
        if update.numeric_decimals.is_some() {
            undo.numeric_decimals = Some(format.numeric_decimals);
        }
        if update.numeric_commas.is_some() {
            undo.numeric_commas = Some(format.numeric_commas);
        }
        if update.bold.is_some() {
            undo.bold = Some(format.bold);
        }
        if update.italic.is_some() {
            undo.italic = Some(format.italic);
        }
        if update.text_color.is_some() {
            undo.text_color = Some(format.text_color.clone());
        }
        if update.fill_color.is_some() {
            undo.fill_color = Some(format.fill_color.clone());
        }
        if update.render_size.is_some() {
            undo.render_size = Some(format.render_size.clone());
        }
        if undo.is_default() {
            None
        } else {
            Some(undo)
        }
    }

    pub fn set_formats_selection(
        &mut self,
        selection: &Selection,
        formats: &Formats,
    ) -> (Vec<Operation>, HashSet<Pos>, Vec<i64>) {
        if selection.all {
            self.set_format_all(formats)
        } else {
            let mut ops = vec![];
            let mut dirty_hashes = HashSet::new();
            let mut resize = vec![];
            if let Some(columns) = selection.columns.as_ref() {
                let (operations, hashes, resize_rows) = self.set_formats_columns(columns, formats);
                ops.extend(operations);
                dirty_hashes.extend(hashes);
                resize.extend(resize_rows);
            }
            if let Some(rows) = selection.rows.as_ref() {
                let (operations, hashes, resize_rows) = self.set_formats_rows(rows, formats);
                ops.extend(operations);
                dirty_hashes.extend(hashes);
                resize.extend(resize_rows);
            }
            if let Some(rects) = selection.rects.as_ref() {
                let (operations, hashes, resize_rows) = self.set_formats_rects(rects, formats);
                ops.extend(operations);
                dirty_hashes.extend(hashes);
                resize.extend(resize_rows);
            }
            (ops, dirty_hashes, resize)
        }
    }

    /// Gets sheet formats (ie, all, columns, and row formats) for a selection.
    pub fn sheet_formats(
        &self,
        selection: &Selection,
        clipboard_origin: &ClipboardOrigin,
    ) -> ClipboardSheetFormats {
        if selection.all {
            ClipboardSheetFormats {
                all: self.format_all.clone(),
                ..Default::default()
            }
        } else {
            let columns: HashMap<i64, Format> = match selection.columns.as_ref() {
                None => HashMap::new(),
                Some(columns) => columns
                    .iter()
                    .filter_map(|column| {
                        self.try_format_column(*column)
                            .map(|format| (*column - clipboard_origin.x, format.clone()))
                    })
                    .collect(),
            };
            let rows = match selection.rows.as_ref() {
                None => HashMap::new(),
                Some(rows) => rows
                    .iter()
                    .filter_map(|row| {
                        self.try_format_row(*row)
                            .map(|format| (*row - clipboard_origin.y, format.clone()))
                    })
                    .collect(),
            };
            ClipboardSheetFormats {
                columns,
                rows,
                ..Default::default()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::operations::clipboard::ClipboardOrigin,
        grid::{
            formats::{format::Format, format_update::FormatUpdate, Formats},
            sheet,
        },
        selection::Selection,
    };
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn sheet_formats() {
        let mut sheet = sheet::Sheet::test();
        sheet.set_formats_columns(
            &[2, 3],
            &Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..Default::default()
                },
                2,
            ),
        );
        sheet.set_formats_rows(
            &[1, 2],
            &Formats::repeat(
                FormatUpdate {
                    italic: Some(Some(true)),
                    ..Default::default()
                },
                2,
            ),
        );
        let selection = Selection {
            columns: Some(vec![2]),
            rows: Some(vec![2]),
            ..Default::default()
        };
        let formats = sheet.sheet_formats(&selection, &ClipboardOrigin::default());
        assert_eq!(formats.columns.len(), 1);
        assert_eq!(formats.rows.len(), 1);
        assert_eq!(formats.columns[&2].bold, Some(true));
        assert_eq!(formats.rows[&2].italic, Some(true));

        sheet.set_format_all(&Formats::repeat(
            FormatUpdate {
                wrap: Some(Some(crate::grid::CellWrap::Overflow)),
                ..Default::default()
            },
            1,
        ));
        // note that columns and rows are ignored when all is true
        let formats = sheet.sheet_formats(
            &Selection {
                all: true,
                rows: Some(vec![2]),
                columns: Some(vec![2]),
                ..Default::default()
            },
            &ClipboardOrigin::default(),
        );
        assert_eq!(
            formats.all,
            Some(Format {
                wrap: Some(crate::grid::CellWrap::Overflow),
                ..Default::default()
            })
        );
        assert_eq!(formats.columns.len(), 0);
        assert_eq!(formats.rows.len(), 0);
    }
}
