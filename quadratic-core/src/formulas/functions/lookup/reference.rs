//! Reference functions: ROW, COLUMN, ROWS, COLUMNS, ADDRESS, INDIRECT, INDEX, OFFSET, AREAS, RTD

use crate::{ArraySize, CodeResultExt, a1::SheetCellRefRange, a1::column_name};

use super::*;

/// Helper function to convert a column number to letter(s) (1-indexed)
fn column_number_to_letter(col: u32) -> String {
    column_name(col as i64)
}

pub(super) fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns the row number of a reference.
            /// If no reference is provided, returns the row of the current cell.
            #[examples("ROW(A5) = 5", "ROW()")]
            fn ROW(ctx: Ctx, span: Span, reference: (Option<Spanned<Array>>)) {
                match reference {
                    Some(_arr) => {
                        // Get the row of the referenced cell from cells_accessed
                        // to_rect returns 1-indexed coordinates
                        let a1_context = ctx.grid_controller.a1_context();
                        let ref_pos =
                            ctx.cells_accessed
                                .cells
                                .iter()
                                .find_map(|(_sheet_id, ranges)| {
                                    ranges.iter().find_map(|range| range.to_rect(a1_context))
                                });
                        match ref_pos {
                            Some(rect) => rect.min.y,
                            None => {
                                return Err(RunErrorMsg::BadCellReference.with_span(span));
                            }
                        }
                    }
                    None => {
                        // Return the row of the current cell
                        // sheet_pos.y is 0-indexed, so add 1 for Excel-style 1-indexed
                        ctx.sheet_pos.y + 1
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the column number of a reference.
            /// If no reference is provided, returns the column of the current cell.
            #[examples("COLUMN(C5) = 3", "COLUMN()")]
            fn COLUMN(ctx: Ctx, span: Span, reference: (Option<Spanned<Array>>)) {
                match reference {
                    Some(_arr) => {
                        // Get the column of the referenced cell from cells_accessed
                        // to_rect returns 1-indexed coordinates
                        let a1_context = ctx.grid_controller.a1_context();
                        let ref_pos =
                            ctx.cells_accessed
                                .cells
                                .iter()
                                .find_map(|(_sheet_id, ranges)| {
                                    ranges.iter().find_map(|range| range.to_rect(a1_context))
                                });
                        match ref_pos {
                            Some(rect) => rect.min.x,
                            None => {
                                return Err(RunErrorMsg::BadCellReference.with_span(span));
                            }
                        }
                    }
                    None => {
                        // Return the column of the current cell
                        // sheet_pos.x is already 1-indexed
                        ctx.sheet_pos.x
                    }
                }
            }
        ),
        formula_fn!(
            /// Returns the number of rows in a reference or array.
            #[examples("ROWS(A1:B10) = 10", "ROWS({1,2,3;4,5,6}) = 2")]
            fn ROWS(array: Array) {
                array.height() as i64
            }
        ),
        formula_fn!(
            /// Returns the number of columns in a reference or array.
            #[examples("COLUMNS(A1:E1) = 5", "COLUMNS({1,2,3;4,5,6}) = 3")]
            fn COLUMNS(array: Array) {
                array.width() as i64
            }
        ),
        formula_fn!(
            /// Creates a cell address as text, given row and column numbers.
            ///
            /// - `row_num`: The row number (1-indexed).
            /// - `column_num`: The column number (1-indexed).
            /// - `abs_num`: Optional. The type of reference:
            ///   - 1 or omitted: Absolute ($A$1)
            ///   - 2: Absolute row, relative column (A$1)
            ///   - 3: Relative row, absolute column ($A1)
            ///   - 4: Relative (A1)
            /// - `a1`: Optional. TRUE for A1 style (default), FALSE for R1C1 style.
            /// - `sheet_text`: Optional. The name of the sheet to include.
            #[examples(
                "ADDRESS(1, 1) = \"$A$1\"",
                "ADDRESS(1, 1, 4) = \"A1\"",
                "ADDRESS(1, 1, 1, TRUE, \"Sheet1\") = \"Sheet1!$A$1\""
            )]
            #[zip_map]
            fn ADDRESS(
                span: Span,
                [row_num]: (Spanned<i64>),
                [column_num]: (Spanned<i64>),
                [abs_num]: (Option<Spanned<i64>>),
                [a1]: (Option<bool>),
                [sheet_text]: (Option<String>),
            ) {
                let row = row_num.inner;
                let col = column_num.inner;

                if row < 1 || col < 1 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let abs_type = abs_num.map(|s| s.inner).unwrap_or(1);
                let use_a1_style = a1.unwrap_or(true);

                let address = if use_a1_style {
                    // Convert column number to letters
                    let col_letter = column_number_to_letter(col as u32);
                    match abs_type {
                        1 => format!("${}${}", col_letter, row),
                        2 => format!("{}${}", col_letter, row),
                        3 => format!("${}{}", col_letter, row),
                        4 => format!("{}{}", col_letter, row),
                        _ => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                    }
                } else {
                    // R1C1 style
                    match abs_type {
                        1 => format!("R{}C{}", row, col),
                        2 => format!("R{}C[{}]", row, col),
                        3 => format!("R[{}]C{}", row, col),
                        4 => format!("R[{}]C[{}]", row, col),
                        _ => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                    }
                };

                match sheet_text {
                    Some(sheet) => format!("{}!{}", sheet, address),
                    None => address,
                }
            }
        ),
        formula_fn!(
            /// Returns the value of the cell at a given location.
            #[examples("INDIRECT(\"Cn7\")", "INDIRECT(\"F\" & B0)")]
            fn INDIRECT(ctx: Ctx, cellref_string: (Spanned<String>)) {
                let span = cellref_string.span;
                let cell_ref = SheetCellRefRange::parse_at(
                    &cellref_string.inner,
                    ctx.sheet_pos,
                    ctx.grid_controller.a1_context(),
                )
                .map_err(|_| RunErrorMsg::BadCellReference.with_span(span))?;
                let sheet_rect = ctx.resolve_range_ref(&cell_ref, span, true)?.inner;
                ctx.get_cell_array(sheet_rect, span)?.inner
            }
        ),
        formula_fn!(
            /// Returns the number of areas in a reference.
            ///
            /// An area is a range of contiguous cells or a single cell. When
            /// multiple ranges are passed as a tuple, this function returns
            /// the count of those ranges.
            #[examples(
                "AREAS(A1:C3) = 1",
                "AREAS((A1:C3, D1:E5)) = 2",
                "AREAS((A1, B2, C3:D4)) = 3"
            )]
            fn AREAS(range: (Spanned<Vec<Array>>)) {
                range.inner.len() as i64
            }
        ),
        formula_fn!(
            /// Returns the element in `range` at a given `row` and `column`. If
            /// the array is a single row, then `row` may be omitted; otherwise
            /// it is required. If the array is a single column, then `column`
            /// may be omitted; otherwise it is required.
            ///
            /// If `range` is a group of multiple range references, then the
            /// extra parameter `range_num` indicates which range to index from.
            ///
            /// When `range` is a range references or a group of range
            /// references, `INDEX` may be used as part of a new range
            /// reference.
            #[examples(
                "INDEX({1, 2, 3; 4, 5, 6}, 1, 3)",
                "INDEX(A1:A100, 42)",
                "INDEX(A6:Q6, 12)",
                "INDEX((A1:B6, C1:D6, D1:D100), 1, 5, C6)",
                "E1:INDEX((A1:B6, C1:D6, D1:D100), 1, 5, C6)",
                "INDEX((A1:B6, C1:D6, D1:D100), 1, 5, C6):E1",
                "INDEX(A3:Q3, A2):INDEX(A6:Q6, A2)"
            )]
            fn INDEX(
                span: Span,
                range: (Spanned<Vec<Array>>),
                row: (Option<Spanned<i64>>),
                column: (Option<Spanned<i64>>),
                range_num: (Option<Spanned<i64>>),
            ) {
                let args = IndexFunctionArgs::from_values(
                    |i| Some(range.inner.get(i)?.size()),
                    row,
                    column,
                    range_num,
                )?;
                range
                    .inner
                    .get(args.tuple_index)
                    .ok_or(RunErrorMsg::IndexOutOfBounds.with_span(span))?
                    .get(args.x, args.y)
                    .cloned()
                    .with_span(span)?
                    .inner
            }
        ),
        formula_fn!(
            /// Returns a reference offset from a given starting reference by a
            /// specified number of rows and columns.
            ///
            /// - `reference`: The starting reference.
            /// - `rows`: The number of rows to offset (can be negative).
            /// - `cols`: The number of columns to offset (can be negative).
            /// - `height`: Optional. The height (number of rows) of the returned reference.
            ///   Defaults to the height of the reference.
            /// - `width`: Optional. The width (number of columns) of the returned reference.
            ///   Defaults to the width of the reference.
            ///
            /// OFFSET returns a reference that can be used in other formulas.
            #[examples(
                "OFFSET(A1, 2, 3)",
                "OFFSET(A1:B2, 1, 1)",
                "OFFSET(A1, 0, 0, 5, 5)",
                "SUM(OFFSET(A1, 0, 0, 10, 1))"
            )]
            fn OFFSET(
                ctx: Ctx,
                span: Span,
                reference: (Spanned<Array>),
                rows: i64,
                cols: i64,
                height: (Option<Spanned<i64>>),
                width: (Option<Spanned<i64>>),
            ) {
                // Get the dimensions of the original reference
                let orig_height = reference.inner.height() as i64;
                let orig_width = reference.inner.width() as i64;

                // Use provided height/width or default to original dimensions
                let new_height = height.map(|h| h.inner).unwrap_or(orig_height);
                let new_width = width.map(|w| w.inner).unwrap_or(orig_width);

                // Validate dimensions
                if new_height <= 0 || new_width <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Get the position of the referenced cell from cells_accessed
                // The reference was just evaluated, so the accessed cells should contain it
                let a1_context = ctx.grid_controller.a1_context();
                let mut ref_pos: Option<(i64, i64)> = None;

                for (_sheet_id, ranges) in ctx.cells_accessed.cells.iter() {
                    for range in ranges.iter() {
                        if let Some(rect) = range.to_rect(a1_context) {
                            // Use the top-left corner of the range as the base position
                            ref_pos = Some((rect.min.x, rect.min.y));
                            break;
                        }
                    }
                    if ref_pos.is_some() {
                        break;
                    }
                }

                let (base_x, base_y) =
                    ref_pos.ok_or_else(|| RunErrorMsg::BadCellReference.with_span(span))?;

                // Calculate new position by offsetting from the reference position
                let new_x = base_x + cols;
                let new_y = base_y + rows;

                // Validate the new position is within bounds
                if new_x < 1 || new_y < 1 {
                    return Err(RunErrorMsg::IndexOutOfBounds.with_span(span));
                }

                // Build the new reference string and use INDIRECT-like evaluation
                let end_x = new_x + new_width - 1;
                let end_y = new_y + new_height - 1;

                let start_col = column_number_to_letter(new_x as u32);
                let end_col = column_number_to_letter(end_x as u32);

                let cell_ref_str = if new_height == 1 && new_width == 1 {
                    format!("{}{}", start_col, new_y)
                } else {
                    format!("{}{}:{}{}", start_col, new_y, end_col, end_y)
                };

                let cell_ref = SheetCellRefRange::parse_at(
                    &cell_ref_str,
                    ctx.sheet_pos,
                    ctx.grid_controller.a1_context(),
                )
                .map_err(|_| RunErrorMsg::BadCellReference.with_span(span))?;

                let sheet_rect = ctx.resolve_range_ref(&cell_ref, span, true)?.inner;
                ctx.get_cell_array(sheet_rect, span)?.inner
            }
        ),
        formula_fn!(
            /// Retrieves real-time data from a COM server.
            ///
            /// In traditional Excel, RTD connects to a COM automation server to
            /// receive real-time data updates (e.g., stock prices, financial data).
            ///
            /// - `prog_id`: The program ID of the RTD server.
            /// - `server`: The server name (empty string for local).
            /// - `topics`: One or more topic strings that identify the data to retrieve.
            ///
            /// **Note**: RTD is not implemented in Quadratic as it requires
            /// Windows COM servers which are not supported in a browser environment.
            #[examples("RTD(\"MyServer.RTD\", \"\", \"Topic1\")")]
            fn RTD(span: Span, _prog_id: String, _server: String, _topics: (Iter<String>)) {
                CellValue::Error(Box::new(
                    RunErrorMsg::Unimplemented(
                        "RTD requires COM servers which are not supported".into(),
                    )
                    .with_span(span),
                ))
            }
        ),
    ]
}

/// Arguments to the `INDEX` function.
#[derive(Debug, Copy, Clone)]
pub struct IndexFunctionArgs {
    /// Which range (0-indexed) to return from.
    pub tuple_index: usize,
    /// X coordinate (0-indexed) within the range.
    pub x: u32,
    /// Y coordinate (0-indexed) within the range.
    pub y: u32,
}
impl IndexFunctionArgs {
    pub fn from_values(
        get_array_size: impl FnOnce(usize) -> Option<ArraySize>,
        mut row: Option<Spanned<i64>>,
        mut column: Option<Spanned<i64>>,
        range_num: Option<Spanned<i64>>,
    ) -> CodeResult<Self> {
        let (tuple_index, array_size) = match range_num {
            // IIFE to mimic try_block
            Some(v) => (|| {
                let i = v.inner.saturating_sub(1).try_into().ok()?;
                Some((i, get_array_size(i)?))
            })()
            .ok_or_else(|| RunErrorMsg::IndexOutOfBounds.with_span(v.span))?,
            None => {
                let array_size = get_array_size(0).ok_or(RunErrorMsg::InternalError(
                    "get_array_size(0) returned None".into(),
                ))?;
                (0, array_size)
            }
        };

        let w = array_size.w.get() as i64;
        let h = array_size.h.get() as i64;
        if h == 1 && column.is_none() {
            std::mem::swap(&mut row, &mut column);
        }

        let x;
        match column {
            Some(column) => {
                x = column.inner.saturating_sub(1);
                if !(0 <= x && x < w) {
                    return Err(RunErrorMsg::IndexOutOfBounds.with_span(column));
                }
            }
            None => x = 0,
        }

        let y;
        match row {
            Some(row) => {
                y = row.inner.saturating_sub(1);
                if !(0 <= y && y < h) {
                    return Err(RunErrorMsg::IndexOutOfBounds.with_span(row));
                }
            }
            None => y = 0,
        }

        Ok(Self {
            tuple_index,
            x: x as u32,
            y: y as u32,
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_indirect() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        g.set_cell_value(pos![sheet_id!D5], 35.to_string(), None, false);

        // Test that INDIRECT correctly reads the value (returns as array wrapper)
        assert_eq!("{35}", eval_to_string(&g, "INDIRECT(\"D5\")"));
    }

    #[test]
    fn test_index() {
        let g = GridController::new();

        assert_eq!("5", eval_to_string(&g, "INDEX({1, 2, 3; 4, 5, 6}, 2, 2)"));
        assert_eq!("3", eval_to_string(&g, "INDEX({1, 2, 3; 4, 5, 6}, 1, 3)"));
        assert_eq!("2", eval_to_string(&g, "INDEX({1, 2, 3}, 2)"));
        assert_eq!("2", eval_to_string(&g, "INDEX({1; 2; 3}, 2)"));

        // `INDEX()` can use a single argument for a linear array
        assert_eq!("6", eval_to_string(&g, "INDEX({5, 6, 7}, 2)"));
        assert_eq!("6", eval_to_string(&g, "INDEX({5; 6; 7}, 2)"));
        assert_eq!("5", eval_to_string(&g, "INDEX({5}, 1)"));
        assert_eq!("5", eval_to_string(&g, "INDEX({5}, 1, 1)"));
        // You can also use that argument as either a row or column
        assert_eq!("7", eval_to_string(&g, "INDEX({5, 6, 7}, , 3)"));
        assert_eq!("7", eval_to_string(&g, "INDEX({5; 6; 7}, 3)"));
        assert_eq!("7", eval_to_string(&g, "INDEX({5; 6; 7}, 3, )"));
        // But out of bounds (for the non-inferred argument) is an error
        expect_err(&RunErrorMsg::IndexOutOfBounds, &g, "INDEX({5, 6, 7}, 2, 2)");
        expect_err(&RunErrorMsg::IndexOutOfBounds, &g, "INDEX({5; 6; 7}, 2, 2)");

        // Nonlinear arrays with a single argument returns the first column/row element
        // This is INDEX behavior when row or column is not specified
        assert_eq!("5", eval_to_string(&g, "INDEX({5, 6; 7, 8}, 1)"));

        expect_err(&RunErrorMsg::IndexOutOfBounds, &g, "INDEX({5}, 0)");
        expect_err(&RunErrorMsg::IndexOutOfBounds, &g, "INDEX({5}, -1)");
        expect_err(&RunErrorMsg::IndexOutOfBounds, &g, "INDEX({5}, 2)");

        // Test tuple handling
        assert_eq!(
            "3",
            eval_to_string(&g, "INDEX(({1, 2}, {3, 4}, {5, 6}), 1, 1, 2)"),
        );
        assert_eq!(
            "2",
            eval_to_string(&g, "INDEX(({1, 2}, {3, 4}, {5, 6}), 1, 2, 1)"),
        );
        expect_err(
            &RunErrorMsg::IndexOutOfBounds,
            &g,
            "INDEX(({1, 2}, {3, 4}, {5, 6}), 1, 1, 4)",
        );

        // Test with grid
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Create array A1:C3 with values 1-9
        // 1 2 3
        // 4 5 6
        // 7 8 9
        for y in 1..=3 {
            for x in 1..=3 {
                let val = ((y - 1) * 3 + x).to_string();
                g.set_cell_value(pos![sheet_id!x,y], val, None, false);
            }
        }

        // Test basic INDEX with grid reference
        assert_eq!("1", eval_to_string(&g, "INDEX(A1:C3, 1, 1)"));
        assert_eq!("5", eval_to_string(&g, "INDEX(A1:C3, 2, 2)"));
        assert_eq!("9", eval_to_string(&g, "INDEX(A1:C3, 3, 3)"));
        assert_eq!("4", eval_to_string(&g, "INDEX(A1:C3, 2, 1)"));
        assert_eq!("6", eval_to_string(&g, "INDEX(A1:C3, 2, 3)"));

        // Test with 1D ranges (column)
        assert_eq!("1", eval_to_string(&g, "INDEX(A1:A3, 1)"));
        assert_eq!("4", eval_to_string(&g, "INDEX(A1:A3, 2)"));
        assert_eq!("7", eval_to_string(&g, "INDEX(A1:A3, 3)"));

        // Test with 1D ranges (row)
        assert_eq!("1", eval_to_string(&g, "INDEX(A1:C1, 1)"));
        assert_eq!("2", eval_to_string(&g, "INDEX(A1:C1, 2)"));
        assert_eq!("3", eval_to_string(&g, "INDEX(A1:C1, 3)"));

        // Error: out of bounds
        expect_err(&RunErrorMsg::IndexOutOfBounds, &g, "INDEX(A1:C3, 0, 1)");
        expect_err(&RunErrorMsg::IndexOutOfBounds, &g, "INDEX(A1:C3, 1, 0)");
        expect_err(&RunErrorMsg::IndexOutOfBounds, &g, "INDEX(A1:C3, 4, 1)");
        expect_err(&RunErrorMsg::IndexOutOfBounds, &g, "INDEX(A1:C3, 1, 4)");
    }

    #[test]
    fn test_row_column() {
        let g = GridController::new();

        // Test COLUMN with cell reference
        assert_eq!("3", eval_to_string(&g, "COLUMN(C5)"));
        assert_eq!("1", eval_to_string(&g, "COLUMN(A1)"));
        assert_eq!("26", eval_to_string(&g, "COLUMN(Z10)"));

        // Test COLUMN without reference (returns current column)
        // When evaluated at A1, should return 1
        assert_eq!("1", eval_to_string(&g, "COLUMN()"));

        // Test ROW with cell reference
        assert_eq!("5", eval_to_string(&g, "ROW(C5)"));
        assert_eq!("1", eval_to_string(&g, "ROW(A1)"));
        assert_eq!("10", eval_to_string(&g, "ROW(Z10)"));

        // Test ROW without reference (returns current row)
        assert_eq!("1", eval_to_string(&g, "ROW()"));

        // Test with range - should return the first row/column
        assert_eq!("3", eval_to_string(&g, "COLUMN(C5:E10)"));
        assert_eq!("5", eval_to_string(&g, "ROW(C5:E10)"));
    }

    #[test]
    fn test_rows_columns() {
        let g = GridController::new();

        // Test ROWS with array
        assert_eq!("2", eval_to_string(&g, "ROWS({1, 2, 3; 4, 5, 6})"));
        assert_eq!("3", eval_to_string(&g, "ROWS({1; 2; 3})"));
        assert_eq!("1", eval_to_string(&g, "ROWS({1, 2, 3})"));

        // Test COLUMNS with array
        assert_eq!("3", eval_to_string(&g, "COLUMNS({1, 2, 3; 4, 5, 6})"));
        assert_eq!("1", eval_to_string(&g, "COLUMNS({1; 2; 3})"));
        assert_eq!("3", eval_to_string(&g, "COLUMNS({1, 2, 3})"));

        // Test with range reference
        assert_eq!("10", eval_to_string(&g, "ROWS(A1:B10)"));
        assert_eq!("5", eval_to_string(&g, "COLUMNS(A1:E1)"));
    }

    #[test]
    fn test_areas() {
        let g = GridController::new();

        // Single area
        assert_eq!("1", eval_to_string(&g, "AREAS(A1:C3)"));

        // Multiple areas as tuple
        assert_eq!("2", eval_to_string(&g, "AREAS((A1:C3, D1:E5))"));
        assert_eq!("3", eval_to_string(&g, "AREAS((A1, B2, C3:D4))"));

        // Single cell is one area
        assert_eq!("1", eval_to_string(&g, "AREAS(A1)"));
    }

    #[test]
    fn test_address() {
        let g = GridController::new();

        // Test A1 style (default)
        assert_eq!("$A$1", eval_to_string(&g, "ADDRESS(1, 1)"));
        assert_eq!("$C$5", eval_to_string(&g, "ADDRESS(5, 3)"));

        // Test different abs_num values
        assert_eq!("$A$1", eval_to_string(&g, "ADDRESS(1, 1, 1)")); // Absolute
        assert_eq!("A$1", eval_to_string(&g, "ADDRESS(1, 1, 2)")); // Absolute row
        assert_eq!("$A1", eval_to_string(&g, "ADDRESS(1, 1, 3)")); // Absolute column
        assert_eq!("A1", eval_to_string(&g, "ADDRESS(1, 1, 4)")); // Relative

        // Test R1C1 style
        assert_eq!("R1C1", eval_to_string(&g, "ADDRESS(1, 1, 1, FALSE)"));

        // Test with sheet name
        assert_eq!(
            "Sheet1!$A$1",
            eval_to_string(&g, "ADDRESS(1, 1, 1, TRUE, \"Sheet1\")")
        );
    }

    #[test]
    fn test_offset() {
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Create some data
        // A1=1, A2=2, A3=3
        // B1=4, B2=5, B3=6
        // C1=7, C2=8, C3=9
        for y in 1..=3 {
            for x in 1..=3 {
                let val = ((x - 1) * 3 + y).to_string();
                g.set_cell_value(pos![sheet_id!x,y], val, None, false);
            }
        }

        // Test basic offset - returns an array wrapper
        assert_eq!("{5}", eval_to_string(&g, "OFFSET(A1, 1, 1)")); // B2

        // Test offset with height/width used in SUM
        assert_eq!("6", eval_to_string(&g, "SUM(OFFSET(A1, 0, 0, 3, 1))")); // Sum of A1:A3

        // Test negative offset (if supported)
        // OFFSET(B2, -1, -1) should give A1
        assert_eq!("{1}", eval_to_string(&g, "OFFSET(B2, -1, -1)"));

        // Test offset from a range - returns array of the offset range
        assert_eq!("{8; 9}", eval_to_string(&g, "OFFSET(A1:A2, 1, 2)")); // C2:C3
    }

    #[test]
    fn test_rtd() {
        let g = GridController::new();

        // RTD should return an unimplemented error
        let result = eval(&g, "RTD(\"MyServer.RTD\", \"\", \"Topic1\")");
        let cell_values = result.cell_values_slice();
        assert!(cell_values.is_ok());
        let values = cell_values.unwrap();
        assert_eq!(values.len(), 1);

        match &values[0] {
            CellValue::Error(e) => {
                assert!(
                    matches!(&e.msg, RunErrorMsg::Unimplemented(_)),
                    "Expected Unimplemented error, got {:?}",
                    e.msg
                );
            }
            other => panic!("Expected error, got {:?}", other),
        }
    }
}
