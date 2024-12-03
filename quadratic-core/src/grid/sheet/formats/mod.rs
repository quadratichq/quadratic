#![allow(unused_imports)] // TODO: remove this

use super::{Sheet, SheetId};
use crate::{
    controller::operations::{
        clipboard::{ClipboardOrigin, ClipboardSheetFormats},
        operation::Operation,
    },
    grid::{
        formats::{
            format::Format,
            format_update::{FormatUpdate, SheetFormatUpdates},
            Formats,
        },
        GridBounds,
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

    /// Returns the dirty hashes and rows changed for the formats
    fn formats_transaction_changes(
        &self,
        formats: &SheetFormatUpdates,
    ) -> (HashSet<Pos>, HashSet<i64>) {
        let mut dirty_hashes = HashSet::new();
        let mut rows_changed = HashSet::new();

        if let GridBounds::NonEmpty(bounds) = self.bounds(true) {
            if let Some(align) = formats.align.as_ref() {
                align.to_rects().for_each(|(x1, y1, x2, y2, _)| {
                    let x2 = x2.unwrap_or(bounds.max.x);
                    let y2 = y2.unwrap_or(bounds.max.y);
                    for y in y1..=y2 {
                        rows_changed.insert(y);
                        for x in x1..=x2 {
                            let mut quadrant = Pos { x, y };
                            quadrant.to_quadrant();
                            dirty_hashes.insert(quadrant);
                        }
                    }
                });
            }
        }
        (dirty_hashes, rows_changed)
    }

    /// Sets formats using SheetFormatUpdates.
    ///
    /// Returns (reverse_operations, dirty_hashes, resize_rows)
    pub fn set_formats_a1(
        &mut self,
        formats: &SheetFormatUpdates,
    ) -> (Vec<Operation>, HashSet<Pos>, HashSet<i64>) {
        let reverse_formats = SheetFormatUpdates {
            align: formats
                .align
                .clone()
                .map(|value| self.formats.align.set_from(value)),
            vertical_align: formats
                .vertical_align
                .clone()
                .map(|value| self.formats.vertical_align.set_from(value)),
            wrap: formats
                .wrap
                .clone()
                .map(|value| self.formats.wrap.set_from(value)),
            numeric_format: formats
                .numeric_format
                .clone()
                .map(|value| self.formats.numeric_format.set_from(value)),
            numeric_decimals: formats
                .numeric_decimals
                .clone()
                .map(|value| self.formats.numeric_decimals.set_from(value)),
            numeric_commas: formats
                .numeric_commas
                .clone()
                .map(|value| self.formats.numeric_commas.set_from(value)),
            bold: formats
                .bold
                .clone()
                .map(|value| self.formats.bold.set_from(value)),
            italic: formats
                .italic
                .clone()
                .map(|value| self.formats.italic.set_from(value)),
            underline: formats
                .underline
                .clone()
                .map(|value| self.formats.underline.set_from(value)),
            text_color: formats
                .text_color
                .clone()
                .map(|value| self.formats.text_color.set_from(value)),
            date_time: formats
                .date_time
                .clone()
                .map(|value| self.formats.date_time.set_from(value)),
            fill_color: formats
                .fill_color
                .clone()
                .map(|value| self.formats.fill_color.set_from(value)),
            render_size: formats
                .render_size
                .clone()
                .map(|value| self.formats.render_size.set_from(value)),
            strike_through: formats
                .strike_through
                .clone()
                .map(|value| self.formats.strike_through.set_from(value)),
        };

        let reverse_op = Operation::SetCellFormatsA1 {
            sheet_id: self.id,
            formats: reverse_formats,
        };

        let (dirty_hashes, rows_changed) = self.formats_transaction_changes(formats);

        (vec![reverse_op], dirty_hashes, rows_changed)
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

    #[test]
    fn test_formats_transaction_changes() {
        todo!()
    }
}
