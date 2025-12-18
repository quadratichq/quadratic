//! Array transformation and reshaping functions.

use super::*;

pub fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns a specified number of rows or columns from an array.
            #[examples("TAKE({1, 2, 3; 4, 5, 6}, 1) = {1, 2, 3}")]
            fn TAKE(
                span: Span,
                array: (Spanned<Array>),
                rows: (Spanned<i64>),
                columns: (Option<Spanned<i64>>),
            ) {
                let arr = array.inner;
                let width = arr.width() as i64;
                let height = arr.height() as i64;
                let rows_to_take = rows.inner;
                let cols_to_take = columns.map(|c| c.inner);

                if rows_to_take == 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(rows.span));
                }
                if cols_to_take == Some(0) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(columns.unwrap().span));
                }

                let (row_start, row_count) = if rows_to_take > 0 {
                    (0, rows_to_take.min(height))
                } else {
                    let count = (-rows_to_take).min(height);
                    (height - count, count)
                };

                let (col_start, col_count) = match cols_to_take {
                    None => (0, width),
                    Some(cols) => {
                        if cols > 0 {
                            (0, cols.min(width))
                        } else {
                            let count = (-cols).min(width);
                            (width - count, count)
                        }
                    }
                };

                let result_size = ArraySize::new(col_count as u32, row_count as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity(result_size.len());
                for y in row_start..(row_start + row_count) {
                    for x in col_start..(col_start + col_count) {
                        values.push(arr.get(x as u32, y as u32)?.clone());
                    }
                }
                Array::new_row_major(result_size, values)?
            }
        ),
        formula_fn!(
            /// Excludes rows or columns from an array.
            #[examples("DROP({1, 2, 3; 4, 5, 6}, 1) = {4, 5, 6}")]
            fn DROP(
                span: Span,
                array: (Spanned<Array>),
                rows: (Spanned<i64>),
                columns: (Option<Spanned<i64>>),
            ) {
                let arr = array.inner;
                let width = arr.width() as i64;
                let height = arr.height() as i64;
                let rows_to_drop = rows.inner;
                let cols_to_drop = columns.map(|c| c.inner).unwrap_or(0);

                let (row_start, new_height) = if rows_to_drop >= 0 {
                    let start = rows_to_drop.min(height);
                    (start, height - start)
                } else {
                    let to_drop = (-rows_to_drop).min(height);
                    (0, height - to_drop)
                };

                let (col_start, new_width) = if cols_to_drop >= 0 {
                    let start = cols_to_drop.min(width);
                    (start, width - start)
                } else {
                    let to_drop = (-cols_to_drop).min(width);
                    (0, width - to_drop)
                };

                if new_width <= 0 || new_height <= 0 {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }

                let result_size = ArraySize::new(new_width as u32, new_height as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity(result_size.len());
                for y in row_start..(row_start + new_height) {
                    for x in col_start..(col_start + new_width) {
                        values.push(arr.get(x as u32, y as u32)?.clone());
                    }
                }
                Array::new_row_major(result_size, values)?
            }
        ),
        formula_fn!(
            /// Returns the specified columns from an array.
            #[examples("CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1, 3) = {1, 3; 4, 6}")]
            fn CHOOSECOLS(span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;
                let indices: Vec<Spanned<i64>> = args
                    .take_rest()
                    .map(|v| v.try_coerce::<i64>())
                    .collect::<CodeResult<Vec<_>>>()?;

                if indices.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "CHOOSECOLS".into(),
                        arg_name: "col_num1".into(),
                    }
                    .with_span(span));
                }

                let width = array.width() as i64;
                let height = array.height();
                let col_indices: Vec<u32> = indices
                    .iter()
                    .map(|idx| {
                        let i = idx.inner;
                        if i == 0 {
                            return Err(RunErrorMsg::IndexOutOfBounds.with_span(idx.span));
                        }
                        let col = if i > 0 { i - 1 } else { width + i };
                        if col < 0 || col >= width {
                            return Err(RunErrorMsg::IndexOutOfBounds.with_span(idx.span));
                        }
                        Ok(col as u32)
                    })
                    .collect::<CodeResult<Vec<_>>>()?;

                let result_size = ArraySize::new(col_indices.len() as u32, height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity(result_size.len());
                for y in 0..height {
                    for &col in &col_indices {
                        values.push(array.get(col, y)?.clone());
                    }
                }
                Array::new_row_major(result_size, values)?
            }
        ),
        formula_fn!(
            /// Returns the specified rows from an array.
            #[examples("CHOOSEROWS({1, 2, 3; 4, 5, 6}, 1) = {1, 2, 3}")]
            fn CHOOSEROWS(span: Span, args: FormulaFnArgs) {
                let mut args = args;
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;
                let indices: Vec<Spanned<i64>> = args
                    .take_rest()
                    .map(|v| v.try_coerce::<i64>())
                    .collect::<CodeResult<Vec<_>>>()?;

                if indices.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "CHOOSEROWS".into(),
                        arg_name: "row_num1".into(),
                    }
                    .with_span(span));
                }

                let width = array.width();
                let height = array.height() as i64;
                let row_indices: Vec<u32> = indices
                    .iter()
                    .map(|idx| {
                        let i = idx.inner;
                        if i == 0 {
                            return Err(RunErrorMsg::IndexOutOfBounds.with_span(idx.span));
                        }
                        let row = if i > 0 { i - 1 } else { height + i };
                        if row < 0 || row >= height {
                            return Err(RunErrorMsg::IndexOutOfBounds.with_span(idx.span));
                        }
                        Ok(row as u32)
                    })
                    .collect::<CodeResult<Vec<_>>>()?;

                let result_size = ArraySize::new(width, row_indices.len() as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity(result_size.len());
                for &row in &row_indices {
                    for x in 0..width {
                        values.push(array.get(x, row)?.clone());
                    }
                }
                Array::new_row_major(result_size, values)?
            }
        ),
        formula_fn!(
            /// Expands or pads an array.
            #[examples("EXPAND({1, 2; 3, 4}, 3, 3)")]
            fn EXPAND(
                span: Span,
                array: (Spanned<Array>),
                rows: (Option<Spanned<i64>>),
                columns: (Option<Spanned<i64>>),
                pad_with: (Option<CellValue>),
            ) {
                let arr = array.inner;
                let orig_width = arr.width() as i64;
                let orig_height = arr.height() as i64;
                let target_rows = rows.map(|r| r.inner).unwrap_or(orig_height);
                let target_cols = columns.map(|c| c.inner).unwrap_or(orig_width);

                if target_rows < orig_height || target_cols < orig_width {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if target_rows <= 0 || target_cols <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let result_size = ArraySize::new(target_cols as u32, target_rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let pad_value = pad_with.unwrap_or_else(|| {
                    CellValue::Error(Box::new(RunErrorMsg::NotAvailable.with_span(span)))
                });
                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity(result_size.len());
                for y in 0..target_rows {
                    for x in 0..target_cols {
                        if x < orig_width && y < orig_height {
                            values.push(arr.get(x as u32, y as u32)?.clone());
                        } else {
                            values.push(pad_value.clone());
                        }
                    }
                }
                Array::new_row_major(result_size, values)?
            }
        ),
        formula_fn!(
            /// Stacks arrays horizontally.
            #[examples("HSTACK({1; 2}, {3; 4}) = {1, 3; 2, 4}")]
            fn HSTACK(span: Span, arrays: (Iter<Spanned<Array>>)) {
                let arrays: Vec<Spanned<Array>> = arrays.collect::<CodeResult<Vec<_>>>()?;
                if arrays.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "HSTACK".into(),
                        arg_name: "array1".into(),
                    }
                    .with_span(span));
                }

                let max_height = arrays.iter().map(|a| a.inner.height()).max().unwrap_or(1);
                for arr in &arrays {
                    let h = arr.inner.height();
                    if h != 1 && h != max_height {
                        return Err(RunErrorMsg::ArrayAxisMismatch {
                            axis: Axis::Y,
                            expected: max_height,
                            got: h,
                        }
                        .with_span(arr.span));
                    }
                }

                let total_width: u32 = arrays.iter().map(|a| a.inner.width()).sum();
                let size = ArraySize::new(total_width, max_height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut values: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());
                for row in 0..max_height {
                    for arr in &arrays {
                        let arr_height = arr.inner.height();
                        let source_row = if arr_height == 1 { 0 } else { row };
                        for col in 0..arr.inner.width() {
                            values.push(arr.inner.get(col, source_row)?.clone());
                        }
                    }
                }
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Stacks arrays vertically.
            #[examples("VSTACK({1, 2}, {3, 4}) = {1, 2; 3, 4}")]
            fn VSTACK(span: Span, arrays: (Iter<Spanned<Array>>)) {
                let arrays: Vec<Spanned<Array>> = arrays.collect::<CodeResult<Vec<_>>>()?;
                if arrays.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "VSTACK".into(),
                        arg_name: "array1".into(),
                    }
                    .with_span(span));
                }

                let max_width = arrays.iter().map(|a| a.inner.width()).max().unwrap_or(1);
                for arr in &arrays {
                    let w = arr.inner.width();
                    if w != 1 && w != max_width {
                        return Err(RunErrorMsg::ArrayAxisMismatch {
                            axis: Axis::X,
                            expected: max_width,
                            got: w,
                        }
                        .with_span(arr.span));
                    }
                }

                let total_height: u32 = arrays.iter().map(|a| a.inner.height()).sum();
                let size = ArraySize::new(max_width, total_height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut values: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());
                for arr in &arrays {
                    let arr_width = arr.inner.width();
                    for row in 0..arr.inner.height() {
                        for col in 0..max_width {
                            let source_col = if arr_width == 1 { 0 } else { col };
                            values.push(arr.inner.get(source_col, row)?.clone());
                        }
                    }
                }
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Converts an array to a single column.
            #[examples("TOCOL({1, 2; 3, 4}) = {1; 2; 3; 4}")]
            fn TOCOL(
                span: Span,
                array: Array,
                ignore: (Option<Spanned<i64>>),
                scan_by_column: (Option<bool>),
            ) {
                let ignore_mode = ignore.map(|i| i.inner).unwrap_or(0);
                if !(0..=3).contains(&ignore_mode) {
                    return Err(RunErrorMsg::InvalidArgument
                        .with_span(ignore.map(|i| i.span).unwrap_or(span)));
                }
                let by_column = scan_by_column.unwrap_or(false);
                let ignore_blanks = ignore_mode == 1 || ignore_mode == 3;
                let ignore_errors = ignore_mode == 2 || ignore_mode == 3;

                let mut values: SmallVec<[CellValue; 1]> = SmallVec::new();
                if by_column {
                    for col in 0..array.width() {
                        for row in 0..array.height() {
                            let value = array.get(col, row)?;
                            if should_include_value(value, ignore_blanks, ignore_errors) {
                                values.push(value.clone());
                            }
                        }
                    }
                } else {
                    for row in 0..array.height() {
                        for col in 0..array.width() {
                            let value = array.get(col, row)?;
                            if should_include_value(value, ignore_blanks, ignore_errors) {
                                values.push(value.clone());
                            }
                        }
                    }
                }
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let size = ArraySize::new(1, values.len() as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Converts an array to a single row.
            #[examples("TOROW({1; 2; 3}) = {1, 2, 3}")]
            fn TOROW(
                span: Span,
                array: Array,
                ignore: (Option<Spanned<i64>>),
                scan_by_column: (Option<bool>),
            ) {
                let ignore_mode = ignore.map(|i| i.inner).unwrap_or(0);
                if !(0..=3).contains(&ignore_mode) {
                    return Err(RunErrorMsg::InvalidArgument
                        .with_span(ignore.map(|i| i.span).unwrap_or(span)));
                }
                let by_column = scan_by_column.unwrap_or(false);
                let ignore_blanks = ignore_mode == 1 || ignore_mode == 3;
                let ignore_errors = ignore_mode == 2 || ignore_mode == 3;

                let mut values: SmallVec<[CellValue; 1]> = SmallVec::new();
                if by_column {
                    for col in 0..array.width() {
                        for row in 0..array.height() {
                            let value = array.get(col, row)?;
                            if should_include_value(value, ignore_blanks, ignore_errors) {
                                values.push(value.clone());
                            }
                        }
                    }
                } else {
                    for row in 0..array.height() {
                        for col in 0..array.width() {
                            let value = array.get(col, row)?;
                            if should_include_value(value, ignore_blanks, ignore_errors) {
                                values.push(value.clone());
                            }
                        }
                    }
                }
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }
                let size = ArraySize::new(values.len() as u32, 1)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Wraps a vector into columns.
            #[examples("WRAPCOLS({1, 2, 3, 4, 5, 6}, 3) = {1, 4; 2, 5; 3, 6}")]
            fn WRAPCOLS(
                span: Span,
                vector: (Spanned<Array>),
                wrap_count: (Spanned<i64>),
                pad_with: (Option<CellValue>),
            ) {
                if wrap_count.inner <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(wrap_count.span));
                }
                let wrap_count = wrap_count.inner as usize;
                let values: Vec<CellValue> =
                    vector.try_as_linear_array()?.iter().cloned().collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }

                let num_cols = (values.len() + wrap_count - 1) / wrap_count;
                let num_rows = wrap_count;
                let pad_value = pad_with.unwrap_or_else(|| {
                    CellValue::Error(Box::new(RunErrorMsg::NotAvailable.with_span(span)))
                });
                let size = ArraySize::new(num_cols as u32, num_rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut result: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());
                for row in 0..num_rows {
                    for col in 0..num_cols {
                        let idx = col * wrap_count + row;
                        result.push(if idx < values.len() {
                            values[idx].clone()
                        } else {
                            pad_value.clone()
                        });
                    }
                }
                Array::new_row_major(size, result)?
            }
        ),
        formula_fn!(
            /// Wraps a vector into rows.
            #[examples("WRAPROWS({1, 2, 3, 4, 5, 6}, 3) = {1, 2, 3; 4, 5, 6}")]
            fn WRAPROWS(
                span: Span,
                vector: (Spanned<Array>),
                wrap_count: (Spanned<i64>),
                pad_with: (Option<CellValue>),
            ) {
                if wrap_count.inner <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(wrap_count.span));
                }
                let wrap_count = wrap_count.inner as usize;
                let values: Vec<CellValue> =
                    vector.try_as_linear_array()?.iter().cloned().collect();
                if values.is_empty() {
                    return Err(RunErrorMsg::EmptyArray.with_span(span));
                }

                let num_rows = (values.len() + wrap_count - 1) / wrap_count;
                let num_cols = wrap_count;
                let pad_value = pad_with.unwrap_or_else(|| {
                    CellValue::Error(Box::new(RunErrorMsg::NotAvailable.with_span(span)))
                });
                let size = ArraySize::new(num_cols as u32, num_rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                let mut result: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());
                for row in 0..num_rows {
                    for col in 0..num_cols {
                        let idx = row * wrap_count + col;
                        result.push(if idx < values.len() {
                            values[idx].clone()
                        } else {
                            pad_value.clone()
                        });
                    }
                }
                Array::new_row_major(size, result)?
            }
        ),
        formula_fn!(
            /// Creates a clickable hyperlink.
            #[examples("HYPERLINK(\"https://example.com\")")]
            #[zip_map]
            fn HYPERLINK([link_location]: String, [friendly_name]: (Option<String>)) {
                friendly_name.unwrap_or(link_location)
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_take() {
        let g = GridController::new();
        assert_eq!(
            "{1, 2, 3}",
            eval_to_string(&g, "TAKE({1, 2, 3; 4, 5, 6}, 1)")
        );
    }

    #[test]
    fn test_formula_drop() {
        let g = GridController::new();
        assert_eq!(
            "{4, 5, 6}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6}, 1)")
        );
    }

    #[test]
    fn test_formula_hstack() {
        let g = GridController::new();
        assert_eq!("{1, 3; 2, 4}", eval_to_string(&g, "HSTACK({1; 2}, {3; 4})"));
    }

    #[test]
    fn test_formula_vstack() {
        let g = GridController::new();
        assert_eq!("{1, 2; 3, 4}", eval_to_string(&g, "VSTACK({1, 2}, {3, 4})"));
    }

    #[test]
    fn test_formula_tocol() {
        let g = GridController::new();
        assert_eq!("{1; 2; 3; 4}", eval_to_string(&g, "TOCOL({1, 2; 3, 4})"));
    }

    #[test]
    fn test_formula_torow() {
        let g = GridController::new();
        assert_eq!("{1, 2, 3, 4}", eval_to_string(&g, "TOROW({1; 2; 3; 4})"));
    }
}
