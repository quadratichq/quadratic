use itertools::Itertools;

use crate::{
    OldSelection, Rect, SheetPos, SheetRect,
    a1::{A1Context, ColRange, RefRangeBounds, TableRef},
};

use super::*;

impl From<OldSelection> for A1Selection {
    fn from(value: OldSelection) -> Self {
        let OldSelection {
            sheet_id,
            x,
            y,
            rects,
            rows,
            columns,
            all,
        } = value;

        let mut ranges = if all {
            vec![CellRefRange::ALL]
        } else {
            itertools::chain!(
                rows.into_iter()
                    .flatten()
                    .map(CellRefRange::new_relative_row),
                columns
                    .into_iter()
                    .flatten()
                    .map(CellRefRange::new_relative_column),
                rects
                    .into_iter()
                    .flatten()
                    .map(CellRefRange::new_relative_rect),
            )
            .collect()
        };

        if ranges.is_empty() {
            ranges.push(CellRefRange::new_relative_pos(Pos { x, y }));
        }

        Self {
            sheet_id,
            cursor: Pos { x, y },
            ranges,
        }
    }
}

impl A1Selection {
    /// Constructs a basic selection containing a single region.
    pub fn from_range(range: CellRefRange, sheet: SheetId, a1_context: &A1Context) -> Self {
        Self {
            sheet_id: sheet,
            cursor: Self::cursor_pos_from_last_range(&range, a1_context),
            ranges: vec![range],
        }
    }

    pub fn from_ranges(
        ranges: Vec<CellRefRange>,
        sheet: SheetId,
        a1_context: &A1Context,
    ) -> Option<Self> {
        if ranges.is_empty() {
            None
        } else {
            Some(Self {
                sheet_id: sheet,
                cursor: Self::cursor_pos_from_last_range(ranges.last().unwrap(), a1_context),
                ranges,
            })
        }
    }

    /// Creates a selection with a table (only data)
    pub fn table(pos: SheetPos, name: &str) -> Self {
        Self {
            sheet_id: pos.sheet_id,
            cursor: pos.into(),
            ranges: vec![CellRefRange::Table {
                range: TableRef {
                    table_name: name.to_string(),
                    data: true,
                    headers: false,
                    totals: false,
                    col_range: ColRange::All,
                    this_row: false,
                },
            }],
        }
    }

    /// Creates a selection from a table name and a list of column names.
    pub fn from_table_columns(
        table_name: &str,
        columns: Vec<String>,
        a1_context: &A1Context,
    ) -> Option<Self> {
        let table_entry = a1_context.try_table(table_name)?;
        if columns.is_empty() {
            return None;
        }

        let mut ranges = vec![];
        let cursor = Pos {
            x: table_entry.bounds.min.x,
            y: table_entry.bounds.min.y + (if table_entry.show_name { 1 } else { 0 }),
        };
        if columns.len() == 1 {
            if table_entry.visible_columns.contains(&columns[0]) {
                ranges.push(ColRange::Col(columns[0].clone()));
            }
        } else {
            // get a list of indicies from the column names
            let indicies = columns
                .iter()
                .filter_map(|col| table_entry.try_col_index(col))
                .sorted()
                .collect::<Vec<_>>();

            // check if indicies are contiguous
            if !indicies.is_empty()
                && (1..indicies.len()).all(|i| indicies[i] == indicies[i - 1] + 1)
            {
                ranges.push(ColRange::ColRange(
                    table_entry.all_columns[indicies[0] as usize].clone(),
                    table_entry.all_columns[indicies[indicies.len() - 1] as usize].clone(),
                ));
            } else {
                indicies.iter().for_each(|i| {
                    ranges.push(ColRange::Col(table_entry.all_columns[*i as usize].clone()));
                });
            }
        }

        if ranges.is_empty() {
            None
        } else {
            Some(Self {
                sheet_id: table_entry.sheet_id(),
                cursor,
                ranges: ranges
                    .into_iter()
                    .map(|range| CellRefRange::Table {
                        range: TableRef {
                            table_name: table_entry.table_name.clone(),
                            data: true,
                            headers: false,
                            totals: false,
                            col_range: range,
                            this_row: false,
                        },
                    })
                    .collect(),
            })
        }
    }

    pub fn from_ref_range_bounds(sheet_id: SheetId, range: RefRangeBounds) -> Self {
        Self {
            sheet_id,
            cursor: range.cursor_pos_from_last_range(),
            ranges: vec![CellRefRange::Sheet { range }],
        }
    }

    fn from_sheet_ranges(
        ranges: Vec<RefRangeBounds>,
        sheet: SheetId,
        a1_context: &A1Context,
    ) -> Option<Self> {
        if ranges.is_empty() {
            None
        } else {
            let ranges = ranges
                .into_iter()
                .map(|range| CellRefRange::Sheet { range })
                .collect();
            Self::from_ranges(ranges, sheet, a1_context)
        }
    }

    /// Constructs a selection containing a single cell.
    pub fn from_single_cell(sheet_pos: SheetPos) -> Self {
        Self::from_ref_range_bounds(
            sheet_pos.sheet_id,
            RefRangeBounds::new_relative_pos(sheet_pos.into()),
        )
    }

    /// Constructs a selection containing a single rectangle.
    pub fn from_rect(sheet_rect: SheetRect) -> Self {
        Self::from_ref_range_bounds(
            sheet_rect.sheet_id,
            RefRangeBounds::new_relative_rect(sheet_rect.into()),
        )
    }

    /// Constructs a selection from a list of rectangles.
    pub fn from_rects(rects: Vec<Rect>, sheet_id: SheetId, a1_context: &A1Context) -> Option<Self> {
        let ranges = rects
            .into_iter()
            .map(RefRangeBounds::new_relative_rect)
            .collect::<Vec<_>>();
        Self::from_sheet_ranges(ranges, sheet_id, a1_context)
    }

    /// Constructs a selection containing a single cell.
    pub fn from_xy(x: i64, y: i64, sheet: SheetId) -> Self {
        let sheet_id = sheet;
        Self::from_single_cell(SheetPos { x, y, sheet_id })
    }

    pub fn from_pos(pos: Pos, sheet_id: SheetId) -> Self {
        Self::from_ref_range_bounds(sheet_id, RefRangeBounds::new_relative_pos(pos))
    }

    /// Constructs a selection all for a sheet.
    pub fn all(sheet: SheetId) -> Self {
        Self::from_ref_range_bounds(sheet, RefRangeBounds::ALL)
    }

    /// Constructs the default selection, which contains only the cell A1.
    pub fn default(sheet: SheetId) -> Self {
        Self::from_single_cell(pos![A1].to_sheet_pos(sheet))
    }

    /// Constructs a selection for a range of columns.
    pub fn cols(sheet: SheetId, col_start: i64, col_end: i64) -> Self {
        Self {
            sheet_id: sheet,
            cursor: Pos { x: col_start, y: 1 },
            ranges: vec![CellRefRange::Sheet {
                range: RefRangeBounds::new_relative_column_range(col_start, col_end),
            }],
        }
    }

    /// Constructs a selection for a range of rows.
    pub fn rows(sheet: SheetId, row_start: i64, row_end: i64) -> Self {
        Self {
            sheet_id: sheet,
            cursor: Pos { x: 0, y: row_start },
            ranges: vec![CellRefRange::Sheet {
                range: RefRangeBounds::new_relative_row_range(row_start, row_end),
            }],
        }
    }

    /// Returns a test selection from the A1-string with SheetId::TEST.
    #[cfg(test)]
    pub fn test_a1(a1: &str) -> Self {
        Self::parse(a1, SheetId::TEST, &A1Context::default(), None).unwrap()
    }

    /// Returns a test selection from the A1-string with the given sheet ID.
    #[cfg(test)]
    pub fn test_a1_sheet_id(a1: &str, sheet_id: SheetId) -> Self {
        Self::parse(a1, sheet_id, &A1Context::default(), None).unwrap()
    }

    #[cfg(test)]
    #[track_caller]
    pub fn test_a1_context(a1: &str, a1_context: &A1Context) -> Self {
        Self::parse(a1, SheetId::TEST, a1_context, None).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{a1::TableMapEntry, grid::CodeCellLanguage};

    #[test]
    fn test_cols() {
        let selection = A1Selection::cols(SheetId::TEST, 1, 3);
        assert_eq!(selection.ranges.len(), 1);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Sheet {
                range: RefRangeBounds::new_relative_column_range(1, 3)
            }
        );
    }

    #[test]
    fn test_rows() {
        let selection = A1Selection::rows(SheetId::TEST, 1, 3);
        assert_eq!(selection.ranges.len(), 1);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Sheet {
                range: RefRangeBounds::new_relative_row_range(1, 3)
            }
        );
    }

    #[test]
    fn test_from_table_columns() {
        // Create a test A1Context with a table
        let mut a1_context = A1Context::default();
        let table_name = "TestTable";
        let sheet_id = SheetId::TEST;

        // Create a table with 5 columns using the test helper
        let table_entry = TableMapEntry::test(
            table_name,
            &["A", "B", "C", "D", "E"],
            None,
            Rect::test_a1("A1:E10"),
            CodeCellLanguage::Import,
        );
        a1_context.table_map.insert(table_entry);

        // Test single column
        let selection =
            A1Selection::from_table_columns(table_name, vec!["B".to_string()], &a1_context)
                .unwrap();
        assert_eq!(selection.ranges.len(), 1);
        assert_eq!(selection.sheet_id, sheet_id);
        assert_eq!(selection.cursor, Pos { x: 1, y: 2 });

        // Test contiguous columns
        let selection = A1Selection::from_table_columns(
            table_name,
            vec!["B".to_string(), "C".to_string(), "D".to_string()],
            &a1_context,
        )
        .unwrap();
        assert_eq!(selection.ranges.len(), 1);
        assert_eq!(selection.sheet_id, sheet_id);
        assert_eq!(selection.cursor, Pos { x: 1, y: 2 });

        // Test non-contiguous columns
        let selection = A1Selection::from_table_columns(
            table_name,
            vec!["A".to_string(), "C".to_string(), "E".to_string()],
            &a1_context,
        )
        .unwrap();
        assert_eq!(selection.ranges.len(), 3);
        assert_eq!(selection.sheet_id, sheet_id);
        assert_eq!(selection.cursor, Pos { x: 1, y: 2 });

        // Test non-existent table
        assert!(
            A1Selection::from_table_columns("NonExistentTable", vec!["A".to_string()], &a1_context)
                .is_none()
        );

        // Test empty columns
        assert!(A1Selection::from_table_columns(table_name, vec![], &a1_context).is_none());

        // Test non-existent column
        assert!(
            A1Selection::from_table_columns(table_name, vec!["Z".to_string()], &a1_context)
                .is_none()
        );
    }
}
