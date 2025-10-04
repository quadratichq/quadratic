use crate::a1::{A1Context, RefRangeBounds, TableMapEntry, UNBOUNDED};

use super::*;

impl TableRef {
    /// Converts a table ref to a CellRefRange::RefRangeBounds for use
    /// by the CellsHighlights.ts fn (which draws the dashed rectangles around
    /// cells accessed by code cells)
    pub(crate) fn convert_cells_accessed_to_ref_range_bounds(
        &self,
        show_table_headers_for_python: bool,
        a1_context: &A1Context,
    ) -> Option<RefRangeBounds> {
        let Some(table) = a1_context.try_table(&self.table_name) else {
            // the table may no longer exist
            return None;
        };

        // for html and images, we return only the anchor cell
        if table.is_html_image {
            return Some(RefRangeBounds::new_relative(
                table.bounds.min.x,
                table.bounds.min.y,
                table.bounds.min.x,
                table.bounds.min.y,
            ));
        }
        let (mut y_start, y_end) = table.to_sheet_rows();
        if self.headers && !self.data || show_table_headers_for_python {
            // this is the case where we only want the header row and can ignore force_table_bounds
            y_start = table.bounds.min.y + if table.show_name { 1 } else { 0 };
        } else {
            y_start += table.y_adjustment(false);
        }
        let y_end = if !self.data { y_start } else { y_end };

        self.finish_convert(table, y_start, y_end, false)
    }

    /// Converts the table ref to a list of CellRefRange::RefRangeBounds
    ///
    /// - `use_unbounded` - return an infinite column if selecting a column
    ///   (otherwise returns finite bounds)
    /// - `force_columns` - force column header to be included, even if not
    ///   specified or visible
    /// - `force_table_bounds` - adds table name and column headers if visible,
    ///   even if not specified
    ///
    /// todo: we should probably break this into a few separate functions since
    /// its use varies so much
    ///
    /// (ask David F for more details & accuracy checks on this)
    pub(crate) fn convert_to_ref_range_bounds(
        &self,
        use_unbounded: bool,
        a1_context: &A1Context,

        // forces the columns to be included, regardless of range settings
        force_columns: bool,

        // this returns the table's entire bounds, regardless of the range
        force_table_bounds: bool,
    ) -> Option<RefRangeBounds> {
        let Some(table) = a1_context.try_table(&self.table_name) else {
            // the table may no longer exist
            return None;
        };

        // for html and images, we return the full table bounds
        if table.is_html_image {
            return Some(RefRangeBounds::new_relative(
                table.bounds.min.x,
                table.bounds.min.y,
                table.bounds.max.x,
                table.bounds.max.y,
            ));
        }
        let (mut y_start, y_end) = table.to_sheet_rows();

        if !force_table_bounds {
            y_start += if !self.headers && !force_columns {
                table.y_adjustment(false)
            } else if table.show_name {
                1
            } else {
                0
            };
        } else if self.headers && !self.data {
            // this is the case where we only want the header row and can ignore force_table_bounds
            y_start = table.bounds.min.y + if table.show_name { 1 } else { 0 };
        }
        // this is for the clipboard, we don't want to copy the table name when it's a full column
        else if let ColRange::Col(_) = &self.col_range {
            y_start += table.y_adjustment(true);
        }
        let y_end = if !self.data { y_start } else { y_end };

        self.finish_convert(table, y_start, y_end, use_unbounded)
    }

    /// Helper function to finish the conversion of a table ref to a
    /// CellRefRange::RefRangeBounds by properly mapping to the ColRange. (Used
    /// by both fns above.)
    fn finish_convert(
        &self,
        table: &TableMapEntry,
        y_start: i64,
        y_end: i64,
        use_unbounded: bool,
    ) -> Option<RefRangeBounds> {
        match &self.col_range {
            ColRange::All => {
                let range = RefRangeBounds::new_relative(
                    table.bounds.min.x,
                    y_start,
                    if use_unbounded {
                        UNBOUNDED
                    } else {
                        table.bounds.max.x
                    },
                    if use_unbounded { UNBOUNDED } else { y_end },
                );
                Some(range)
            }
            ColRange::Col(col) => table.try_col_index(col).map(|col| {
                RefRangeBounds::new_relative(
                    col + table.bounds.min.x,
                    y_start,
                    col + table.bounds.min.x,
                    if use_unbounded { UNBOUNDED } else { y_end },
                )
            }),
            ColRange::ColRange(col_range_start, col_range_end) => {
                if let Some((start, end)) = table.try_col_range(col_range_start, col_range_end) {
                    Some(RefRangeBounds::new_relative(
                        start + table.bounds.min.x,
                        y_start,
                        end + table.bounds.min.x,
                        if use_unbounded { UNBOUNDED } else { y_end },
                    ))
                } else {
                    None
                }
            }
            ColRange::ColToEnd(col) => {
                if let Some((start, end)) = table.try_col_range_to_end(col) {
                    Some(RefRangeBounds::new_relative(
                        start + table.bounds.min.x,
                        y_start,
                        if use_unbounded {
                            UNBOUNDED
                        } else {
                            end + table.bounds.min.x
                        },
                        if use_unbounded { UNBOUNDED } else { y_end },
                    ))
                } else {
                    None
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::a1::{A1Selection, CellRefRange};
    use crate::test_util::*;
    use crate::{Rect, test_create_code_table};

    use super::*;

    fn create_test_context(rect: Rect) -> A1Context {
        A1Context::test(&[], &[("test_table", &["Col1", "Col2", "Col3"], rect)])
    }

    #[test]
    fn test_convert_all_columns() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A3:C4"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A2:C4"))
        );
    }

    #[test]
    fn test_convert_all_columns_without_header() {
        let mut context = create_test_context(Rect::test_a1("A1:C3"));
        let mut table = context.table_map.remove("test_table").unwrap();
        table.show_name = false;
        table.show_columns = false;
        context.table_map.insert(table);

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A1:C3"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A1:C3"))
        );
    }

    #[test]
    fn test_convert_single_column() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("Col1".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A3:A4"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("Col1".to_string()),
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A2:A4"))
        );
    }

    #[test]
    fn test_convert_column_range() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("Col1".to_string(), "Col2".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A3:B4"))
        );
        assert_eq!(
            table_ref.convert_to_ref_range_bounds(true, &context, false, false),
            Some(RefRangeBounds::test_a1("A3:B"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("Col1".to_string(), "Col2".to_string()),
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("A2:B4"))
        );
    }

    #[test]
    fn test_convert_column_to_end() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("Col2".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("B3:C4"))
        );

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("Col2".to_string()),
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            Some(RefRangeBounds::test_a1("B2:C4"))
        );
    }

    #[test]
    fn test_convert_nonexistent_table() {
        let context = A1Context::default();

        let table_ref = TableRef {
            table_name: "nonexistent".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, &context, false, false),
            None
        );
    }

    #[test]
    fn test_convert_table_ref_column_name() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("Col1".to_string()),
            data: false,
            headers: true,
            totals: false,
        };

        let bounds = table_ref.convert_to_ref_range_bounds(false, &context, false, true);
        assert_eq!(bounds, Some(RefRangeBounds::test_a1("A2")));
    }

    #[test]
    fn test_convert_cells_accessed_to_ref_range_bounds() {
        let context = create_test_context(Rect::test_a1("A1:C4"));

        // Test with headers only
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: false,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_cells_accessed_to_ref_range_bounds(false, &context),
            Some(RefRangeBounds::test_a1("A2:C2"))
        );

        // Test with data only
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_cells_accessed_to_ref_range_bounds(false, &context),
            Some(RefRangeBounds::test_a1("A3:C4"))
        );

        // Test with both headers and data
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_cells_accessed_to_ref_range_bounds(false, &context),
            Some(RefRangeBounds::test_a1("A3:C4"))
        );

        // Test with show_table_headers_for_python = true
        assert_eq!(
            table_ref.convert_cells_accessed_to_ref_range_bounds(true, &context),
            Some(RefRangeBounds::test_a1("A2:C4"))
        );

        // Test with a single column
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("Col1".to_string()),
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_cells_accessed_to_ref_range_bounds(false, &context),
            Some(RefRangeBounds::test_a1("A3:A4"))
        );

        // Test with a column range
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("Col1".to_string(), "Col2".to_string()),
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_cells_accessed_to_ref_range_bounds(false, &context),
            Some(RefRangeBounds::test_a1("A3:B4"))
        );

        // Test with a column to end
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("Col2".to_string()),
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_cells_accessed_to_ref_range_bounds(false, &context),
            Some(RefRangeBounds::test_a1("B3:C4"))
        );

        // Test with a non-existent table
        let table_ref = TableRef {
            table_name: "nonexistent".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: true,
            totals: false,
        };

        assert_eq!(
            table_ref.convert_cells_accessed_to_ref_range_bounds(false, &context),
            None
        );
    }

    #[test]
    fn test_convert_cells_accessed_to_ref_range_bounds_from_python() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_code_table(&mut gc, sheet_id, pos![B2], 2, 2);

        // ensure the table has UI
        gc.data_table_meta(
            pos![sheet_id!B2],
            None,
            None,
            None,
            Some(Some(true)),
            Some(Some(true)),
            None,
            false,
        );

        let context = gc.a1_context();
        let selection = A1Selection::test_a1_context("table1", context);
        let table = if let CellRefRange::Table { range } = selection.ranges[0].clone() {
            range
        } else {
            panic!("Expected a table reference")
        };

        println!(
            "{:?}",
            table.convert_cells_accessed_to_ref_range_bounds(false, context)
        );
    }

    #[test]
    fn test_convert_to_ref_range_bounds_html_image() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_html_chart(&mut gc, sheet_id, pos![A1], 2, 2);

        let selection = A1Selection::test_a1_context("Python1", gc.a1_context());
        let CellRefRange::Table { range: table_ref } = selection.ranges[0].clone() else {
            panic!("Expected a table reference");
        };

        assert_eq!(
            table_ref.convert_to_ref_range_bounds(false, gc.a1_context(), false, false),
            Some(RefRangeBounds::test_a1("A1:B3"))
        );
    }
}
