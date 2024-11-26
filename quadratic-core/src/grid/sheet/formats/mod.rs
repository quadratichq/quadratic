#![allow(unused_imports)] // TODO: remove this

use super::{Sheet, SheetId};
use crate::{
    controller::operations::{
        clipboard::{ClipboardOrigin, ClipboardSheetFormats},
        operation::Operation,
    },
    grid::formats::{
        format::Format,
        format_update::{FormatUpdate, SheetFormatUpdates},
        Formats,
    },
    selection::OldSelection,
    Pos,
};
use std::collections::HashSet;

pub mod format_all;
pub mod format_cell;
pub mod format_columns;
pub mod format_rects;
pub mod format_rows;

impl Sheet {
    pub fn set_formats_selection(
        &mut self,
        selection: &OldSelection,
        formats: &Formats,
    ) -> (Vec<Operation>, HashSet<Pos>, HashSet<i64>) {
        if selection.all {
            self.set_format_all(formats)
        } else {
            let mut ops = vec![];
            let mut dirty_hashes = HashSet::new();
            let mut resize = HashSet::new();
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

    pub fn set_formats_a1(
        &mut self,
        _sheet_id: SheetId,
        _formats: &SheetFormatUpdates,
    ) -> (Vec<Operation>, HashSet<Pos>, HashSet<i64>) {
        // let mut reverse_op = Operation::SetCellFormatsA1 {
        //     sheet_id,
        //     formats: todo!(),
        // };

        // if selection.all {
        //     self.set_format_all(formats)
        // } else {
        //     let mut ops = vec![];
        //     let mut dirty_hashes = HashSet::new();
        //     let mut resize = HashSet::new();
        //     if let Some(columns) = selection.columns.as_ref() {
        //         let (operations, hashes, resize_rows) = self.set_formats_columns(columns, formats);
        //         ops.extend(operations);
        //         dirty_hashes.extend(hashes);
        //         resize.extend(resize_rows);
        //     }
        //     if let Some(rows) = selection.rows.as_ref() {
        //         let (operations, hashes, resize_rows) = self.set_formats_rows(rows, formats);
        //         ops.extend(operations);
        //         dirty_hashes.extend(hashes);
        //         resize.extend(resize_rows);
        //     }
        //     if let Some(rects) = selection.rects.as_ref() {
        //         let (operations, hashes, resize_rows) = self.set_formats_rects(rects, formats);
        //         ops.extend(operations);
        //         dirty_hashes.extend(hashes);
        //         resize.extend(resize_rows);
        //     }
        //     (ops, dirty_hashes, resize)
        // }
        todo!("todo todo todo")
    }

    /// Gets sheet formats (ie, all, columns, and row formats) for a selection.
    pub fn sheet_formats(
        &self,
        _selection: &OldSelection,
        _clipboard_origin: &ClipboardOrigin,
    ) -> ClipboardSheetFormats {
        todo!("this can use A1Selection instead, right?")
        // if selection.all {
        //     ClipboardSheetFormats {
        //         all: self.format_all.clone(),
        //         ..Default::default()
        //     }
        // } else {
        //     let columns: HashMap<i64, Format> = match selection.columns.as_ref() {
        //         None => HashMap::new(),
        //         Some(columns) => columns
        //             .iter()
        //             .filter_map(|column| {
        //                 self.try_format_column(*column)
        //                     .map(|format| (*column - clipboard_origin.x, format.clone()))
        //             })
        //             .collect(),
        //     };
        //     let rows = match selection.rows.as_ref() {
        //         None => HashMap::new(),
        //         Some(rows) => rows
        //             .iter()
        //             .filter_map(|row| {
        //                 self.try_format_row(*row)
        //                     .map(|format| (*row - clipboard_origin.y, format.clone()))
        //             })
        //             .collect(),
        //     };
        //     ClipboardSheetFormats {
        //         columns,
        //         rows,
        //         ..Default::default()
        //     }
        // }
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
        selection::OldSelection,
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
        let selection = OldSelection {
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
            &OldSelection {
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
