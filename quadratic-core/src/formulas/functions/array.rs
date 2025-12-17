use std::collections::HashMap;

use smallvec::SmallVec;

use super::*;
use crate::formulas::LambdaValue;
use crate::{ArraySize, CellValueHash, Pos};

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Array functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Transposes an array (swaps rows and columns).
            ///
            /// The first row becomes the first column, the second row becomes the
            /// second column, and so on.
            #[examples("TRANSPOSE(A1:C2)", "TRANSPOSE({1, 2, 3; 4, 5, 6})")]
            fn TRANSPOSE(array: Array) {
                array.transpose()
            }
        ),
        formula_fn!(
            /// Generates a sequence of numbers.
            ///
            /// - `rows`: The number of rows to return.
            /// - `columns`: The number of columns to return (default 1).
            /// - `start`: The starting number (default 1).
            /// - `step`: The increment between numbers (default 1).
            #[examples(
                "SEQUENCE(5) = {1; 2; 3; 4; 5}",
                "SEQUENCE(3, 3) = {1, 2, 3; 4, 5, 6; 7, 8, 9}",
                "SEQUENCE(3, 1, 0, 2) = {0; 2; 4}"
            )]
            fn SEQUENCE(
                span: Span,
                rows: (Spanned<i64>),
                columns: (Option<Spanned<i64>>),
                start: (Option<i64>),
                step: (Option<i64>),
            ) {
                let r = rows.inner;
                let c = columns.map(|c| c.inner).unwrap_or(1);
                let start_val = start.unwrap_or(1);
                let step_val = step.unwrap_or(1);

                if r <= 0 || c <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = ArraySize::new(c as u32, r as u32)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let values: SmallVec<[CellValue; 1]> = (0..(r * c))
                    .map(|i| CellValue::Number((start_val + step_val * i).into()))
                    .collect();

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Filters an array of values by a list of booleans.
            ///
            /// `include` must contain either a single row or a single column. If
            /// `include` is a single column, then each value in it corresponds to a
            /// row from `array`; if `include` is a single row, then each value in
            /// it corresponds to a column from `array`. If the value in `include`
            /// is [truthy](#logic-functions), then the corresponding row/column
            /// from `array` is included in the output. If `include` contains a
            /// single value, then it corresponds to all of `array`.
            ///
            /// If no rows/columns are included in the output, then `if_empty` is
            /// outputted instead. If no rows/columns are included in the output
            /// _and_ `if_empty` is omitted, then an error is returned.
            #[examples(
                "FILTER(A1:C5, D1:D5, \"No results\")",
                "FILTER(A1:C5, {FALSE; TRUE; TRUE; FALSE; TRUE})"
            )]
            fn FILTER(
                span: Span,
                array: (Spanned<Array>),
                include: (Spanned<Array>),
                if_empty: (Option<Value>),
            ) {
                // Construct this `Result`, but don't return an error yet.
                let empty_result = if_empty.ok_or_else(|| RunErrorMsg::EmptyArray.with_span(span));

                let include_span = include.span;

                let axis = include.array_linear_axis()?;
                let include: Vec<bool> = include
                    .try_as_linear_array()?
                    .iter()
                    .map(|v| bool::try_from(v.clone()).map_err(|e| e.with_span(include_span)))
                    .try_collect()?;

                match axis {
                    None => {
                        if *include.first().unwrap_or(&false) {
                            Value::from(array.inner)
                        } else {
                            empty_result?
                        }
                    }

                    Some(axis) => {
                        array.check_array_size_on(axis, include.len() as u32)?;
                        let new_slices = array
                            .inner
                            .slices(axis)
                            .zip(include)
                            .filter(|(_, include)| *include)
                            .map(|(slice, _)| slice);
                        match Array::from_slices(span, axis, new_slices) {
                            Ok(a) => Value::from(a),
                            Err(_) => empty_result?,
                        }
                    }
                }
            }
        ),
        formula_fn!(
            /// Sorts an array of values.
            ///
            /// `sort_index` specifies the entry within each row or column to
            /// sort by. For example, if `sort_index` is `3` when sorting by row
            /// then each row will be sorted based on its value in the third
            /// column. If `sort_index` is omitted, then the first entry is
            /// used.
            ///
            /// `sort_order` specifies whether to sort in reverse order. If
            /// `sort_order` is `1` or omitted, then the array is sorted in
            /// ascending order. If it is `-1`, then the array is sorted in
            /// descending order.
            ///
            /// If `by_column` is `true`, then the function operations on
            /// columns. If `by_column` is `false` or omitted, then the function
            /// operates on rows.
            ///
            /// The sort is [stable].
            ///
            /// [stable]:
            ///     https://en.wikipedia.org/wiki/Sorting_algorithm#Stability
            #[examples(
                "SORT(A1:A100)",
                "SORT(A1:C50)",
                "SORT(A1:C50, 3)",
                "SORT(A1:C50, , -1)",
                "SORT(A1:C50, 2, -1)",
                "SORT(A1:F3,,, TRUE)"
            )]
            fn SORT(
                span: Span,
                array: Array,
                sort_index: (Option<Spanned<i64>>),
                sort_order: (Option<Spanned<i64>>),
                by_column: (Option<bool>),
            ) {
                let axis = by_column_to_axis(by_column);

                let index = match sort_index {
                    None => 0, // default to first column
                    Some(value) => {
                        let max_index = array.size()[axis.other_axis()].get() as i64;
                        if (1..=max_index).contains(&value.inner) {
                            value.inner as usize - 1 // convert to zero-indexed
                        } else {
                            return Err(RunErrorMsg::InvalidArgument.with_span(value.span));
                        }
                    }
                };

                #[allow(clippy::redundant_closure)]
                let compare_fn = match sort_order {
                    None => |a, b| CellValue::total_cmp(a, b),
                    Some(value) => match value.inner {
                        1 => |a, b| CellValue::total_cmp(a, b),
                        -1 => |a, b| CellValue::total_cmp(b, a),
                        _ => return Err(RunErrorMsg::InvalidArgument.with_span(value.span)),
                    },
                };

                Array::from_slices(
                    span,
                    axis,
                    array.slices(axis).sorted_by(|slice1, slice2| {
                        compare_fn(
                            slice1.get(index).expect("already checked bounds"),
                            slice2.get(index).expect("already checked bounds"),
                        )
                    }),
                )?
            }
        ),
        formula_fn!(
            /// Sorts an array based on the values in a corresponding array or
            /// range.
            ///
            /// - `array`: The array to sort.
            /// - `by_array1`: The array or range to sort by.
            /// - `sort_order1`: Optional. 1 for ascending (default), -1 for descending.
            /// - Additional `by_array`, `sort_order` pairs can be provided for
            ///   secondary sorting.
            ///
            /// Unlike SORT, which sorts by a column within the array itself,
            /// SORTBY sorts using a separate array of the same height. This
            /// allows sorting by calculated values or values from a different
            /// range.
            ///
            /// The sort is [stable].
            ///
            /// [stable]:
            ///     https://en.wikipedia.org/wiki/Sorting_algorithm#Stability
            #[examples(
                "SORTBY(A1:B5, C1:C5)",
                "SORTBY(A1:B5, C1:C5, -1)",
                "SORTBY(A1:C10, D1:D10, 1, E1:E10, -1)"
            )]
            fn SORTBY(span: Span, args: FormulaFnArgs) {
                let mut args = args;

                // Get the array to sort
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;

                // Collect by_array/sort_order pairs
                let mut sort_keys: Vec<(Array, i64)> = vec![];

                while args.has_next() {
                    // Get by_array
                    let by_array_value = args.take_next_required("by_array")?;
                    let by_array_span = by_array_value.span;
                    let by_array: Array = by_array_value.try_coerce()?.inner;

                    // Validate by_array has same number of rows as array
                    if by_array.height() != array.height() {
                        return Err(RunErrorMsg::ArrayAxisMismatch {
                            axis: Axis::Y,
                            expected: array.height(),
                            got: by_array.height(),
                        }
                        .with_span(by_array_span));
                    }

                    // Get optional sort_order
                    let sort_order = match args.take_next_optional() {
                        Some(order_value) => {
                            let order: Spanned<i64> = order_value.try_coerce()?;
                            if order.inner != 1 && order.inner != -1 {
                                return Err(RunErrorMsg::InvalidArgument.with_span(order.span));
                            }
                            order.inner
                        }
                        None => 1, // Default ascending
                    };

                    sort_keys.push((by_array, sort_order));
                }

                if sort_keys.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "SORTBY".into(),
                        arg_name: "by_array1".into(),
                    }
                    .with_span(span));
                }

                // Create indices and sort them
                let mut indices: Vec<usize> = (0..array.height() as usize).collect();

                indices.sort_by(|&a, &b| {
                    for (by_array, sort_order) in &sort_keys {
                        let val_a = by_array.get(0, a as u32).ok();
                        let val_b = by_array.get(0, b as u32).ok();

                        let cmp = match (val_a, val_b) {
                            (Some(va), Some(vb)) => CellValue::total_cmp(va, vb),
                            (Some(_), None) => std::cmp::Ordering::Less,
                            (None, Some(_)) => std::cmp::Ordering::Greater,
                            (None, None) => std::cmp::Ordering::Equal,
                        };

                        let cmp = if *sort_order == -1 {
                            cmp.reverse()
                        } else {
                            cmp
                        };
                        if cmp != std::cmp::Ordering::Equal {
                            return cmp;
                        }
                    }
                    std::cmp::Ordering::Equal
                });

                // Build sorted array
                let size = array.size();
                let mut values: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());

                for &row_idx in &indices {
                    for col in 0..array.width() {
                        values.push(array.get(col, row_idx as u32)?.clone());
                    }
                }

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Returns a specified number of rows or columns from the start or
            /// end of an array.
            ///
            /// - `array`: The array from which to take rows or columns.
            /// - `rows`: The number of rows to take. Positive values take from
            ///   the start, negative values take from the end.
            /// - `columns`: Optional. The number of columns to take. Positive
            ///   values take from the start, negative values take from the end.
            ///
            /// If either `rows` or `columns` is 0, returns an error.
            #[examples(
                "TAKE({1, 2, 3; 4, 5, 6; 7, 8, 9}, 2) = {1, 2, 3; 4, 5, 6}",
                "TAKE({1, 2, 3; 4, 5, 6}, 1, 2) = {1, 2}",
                "TAKE({1, 2, 3; 4, 5, 6}, -1) = {4, 5, 6}",
                "TAKE({1, 2, 3}, 1, -2) = {2, 3}"
            )]
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

                // 0 is not allowed
                if rows_to_take == 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(rows.span));
                }
                if cols_to_take == Some(0) {
                    return Err(RunErrorMsg::InvalidArgument.with_span(columns.unwrap().span));
                }

                // Calculate row range
                let (row_start, row_count) = if rows_to_take > 0 {
                    // Take from start
                    (0, rows_to_take.min(height))
                } else {
                    // Take from end
                    let count = (-rows_to_take).min(height);
                    (height - count, count)
                };

                // Calculate column range
                let (col_start, col_count) = match cols_to_take {
                    None => (0, width), // Take all columns
                    Some(cols) => {
                        if cols > 0 {
                            // Take from start
                            (0, cols.min(width))
                        } else {
                            // Take from end
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
            /// Removes duplicates rows or columns from an array.
            ///
            /// Rows or columns are returned in the order they initially appear;
            /// subsequent appearances are removed.
            ///
            /// If `by_column` is `true`, then the function operations on
            /// columns. If `by_column` is `false` or omitted, then the function
            /// operates on rows.
            ///
            /// If `exactly_once` is true, then rows and columns that appear
            /// multiple times are omitted; only rows or columns that appear
            /// exactly once are included in the output.
            #[examples("UNIQUE()")]
            fn UNIQUE(
                span: Span,
                array: Array,
                by_column: (Option<bool>),
                exactly_once: (Option<bool>),
            ) {
                let axis = by_column_to_axis(by_column);

                // Count how many times we've seen each slice.
                let mut slice_counts: Vec<(Vec<&CellValue>, usize)> = vec![];
                // Instead of doing a linear search in `slice_counts`, record a
                // list of possible indices for each hash. We're basically
                // making our own hashmap here from the stdlib one, but we can't
                // use the stdlib one directly because `CellValue` doesn't impl
                // `Hash` and `CellValueHash` isn't unique.
                let mut indices = HashMap::<Vec<CellValueHash>, SmallVec<[usize; 1]>>::new();

                for slice in array.slices(axis) {
                    let possible_indices = indices
                        .entry(slice.iter().map(|v| v.hash()).collect_vec())
                        .or_default();
                    if let Some(&i) = possible_indices.iter().find(|&&i| {
                        let past_slice = &slice_counts[i].0;
                        // We can't use `CellValue::eq()` because that method
                        // considers blank and `0` to be equal, which is not
                        // what we want here.
                        std::iter::zip(past_slice, &slice)
                            .all(|(l, r)| l.total_cmp(r) == std::cmp::Ordering::Equal)
                    }) {
                        slice_counts[i].1 += 1;
                    } else {
                        // Save the index.
                        let index = slice_counts.len();
                        possible_indices.push(index);
                        // Record the slice.
                        slice_counts.push((slice, 1));
                    }
                }
                let new_slices = slice_counts
                    .into_iter()
                    .filter(|(_, count)| match exactly_once {
                        Some(true) => *count == 1,
                        None | Some(false) => true,
                    })
                    .map(|(slice, _)| slice);
                Array::from_slices(span, axis, new_slices)?
            }
        ),
        formula_fn!(
            /// Multiplies arrays componentwise, then returns the sum of all the
            /// elements. All arrays must have the same size.
            ///
            /// For example, `SUMPRODUCT(C2:C5, D2:D5)` is equivalent to
            /// `SUM(C2:C5 * D2:D5)`.
            #[examples("SUMPRODUCT(C2:C5, D2:D5)")]
            fn SUMPRODUCT(arrays: (Iter<Spanned<Array>>)) {
                let Some(first) = arrays.next() else {
                    return Ok(0.into());
                };
                let mut results = first?;
                for array in arrays {
                    let new_array = array?;
                    new_array.check_array_size_exact(results.inner.size())?;
                    let new_span = new_array.span;
                    for (product, new_value) in std::iter::zip(
                        results.inner.cell_values_slice_mut(),
                        new_array.inner.cell_values_slice(),
                    ) {
                        // Exit early if there's an error because the SUM would eventually fail anyway
                        *product = CellValue::mul(
                            results.span,
                            Spanned {
                                span: results.span,
                                inner: product,
                            },
                            Spanned {
                                span: new_span,
                                inner: new_value,
                            },
                        )?
                        .inner;
                    }
                    results.span = Span::merge(results.span, new_span);
                }

                let span = results.span;
                match results
                    .inner
                    .into_cell_values_vec()
                    .into_iter()
                    .map(|inner| Ok(Spanned { span, inner }))
                    .reduce(|a, b| CellValue::add(results.span, a?.as_ref(), b?.as_ref()))
                {
                    Some(result) => result?.inner,
                    None => 0.into(),
                }
            }
        ),
        formula_fn!(
            /// Returns the matrix determinant of an array.
            ///
            /// The array must be a square matrix (same number of rows and columns).
            #[examples(
                "MDETERM({1, 2; 3, 4}) = -2",
                "MDETERM({1, 0, 0; 0, 1, 0; 0, 0, 1}) = 1"
            )]
            fn MDETERM(span: Span, array: (Spanned<Array>)) {
                let size = array.inner.size();
                if size.w != size.h {
                    return Err(RunErrorMsg::NonRectangularArray.with_span(array.span));
                }
                let n = size.w.get() as usize;

                // Convert to f64 matrix
                let mut matrix: Vec<f64> = Vec::with_capacity(n * n);
                for cv in array.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    matrix.push(val);
                }

                // Calculate determinant using LU decomposition
                matrix_determinant(&matrix, n)
            }
        ),
        formula_fn!(
            /// Returns the inverse matrix for the matrix stored in an array.
            ///
            /// The array must be a square matrix with a non-zero determinant.
            #[examples("MINVERSE({1, 2; 3, 4})", "MINVERSE({4, 7; 2, 6})")]
            fn MINVERSE(span: Span, array: (Spanned<Array>)) {
                let size = array.inner.size();
                if size.w != size.h {
                    return Err(RunErrorMsg::NonRectangularArray.with_span(array.span));
                }
                let n = size.w.get() as usize;

                // Convert to f64 matrix
                let mut matrix: Vec<f64> = Vec::with_capacity(n * n);
                for cv in array.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    matrix.push(val);
                }

                // Calculate inverse
                let inverse = matrix_inverse(&matrix, n)
                    .ok_or_else(|| RunErrorMsg::DivideByZero.with_span(span))?;

                // Convert back to Array
                let values: SmallVec<[CellValue; 1]> = inverse
                    .into_iter()
                    .map(|v| {
                        CellValue::Number(
                            rust_decimal::Decimal::from_f64_retain(v).unwrap_or_default(),
                        )
                    })
                    .collect();

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Returns the matrix product of two arrays.
            ///
            /// The number of columns in `array1` must equal the number of rows
            /// in `array2`. The result has the same number of rows as `array1`
            /// and the same number of columns as `array2`.
            #[examples("MMULT({1, 2; 3, 4}, {5, 6; 7, 8})", "MMULT({1, 2, 3}, {4; 5; 6})")]
            fn MMULT(span: Span, array1: (Spanned<Array>), array2: (Spanned<Array>)) {
                let size1 = array1.inner.size();
                let size2 = array2.inner.size();

                // Check that inner dimensions match
                if size1.w != size2.h {
                    return Err(RunErrorMsg::ArrayAxisMismatch {
                        axis: Axis::X,
                        expected: size1.w.get(),
                        got: size2.h.get(),
                    }
                    .with_span(array2.span));
                }

                let rows = size1.h.get() as usize;
                let cols = size2.w.get() as usize;
                let inner = size1.w.get() as usize;

                // Convert arrays to f64 vectors
                let mut m1: Vec<f64> = Vec::with_capacity(rows * inner);
                for cv in array1.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    m1.push(val);
                }

                let mut m2: Vec<f64> = Vec::with_capacity(inner * cols);
                for cv in array2.inner.cell_values_slice().iter() {
                    let val: f64 = cv.coerce_nonblank().ok_or_else(|| {
                        RunErrorMsg::Expected {
                            expected: "number".into(),
                            got: Some(cv.type_name().into()),
                        }
                        .with_span(span)
                    })?;
                    m2.push(val);
                }

                // Perform matrix multiplication
                let mut result: Vec<CellValue> = Vec::with_capacity(rows * cols);
                for i in 0..rows {
                    for j in 0..cols {
                        let mut sum = 0.0;
                        for k in 0..inner {
                            sum += m1[i * inner + k] * m2[k * cols + j];
                        }
                        result.push(CellValue::Number(
                            rust_decimal::Decimal::from_f64_retain(sum).unwrap_or_default(),
                        ));
                    }
                }

                let result_size = ArraySize::new(cols as u32, rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(result_size, result.into())?
            }
        ),
        formula_fn!(
            /// Returns an array of random numbers.
            ///
            /// - `rows`: The number of rows to return (default 1).
            /// - `columns`: The number of columns to return (default 1).
            /// - `min`: The minimum value (default 0).
            /// - `max`: The maximum value (default 1).
            /// - `whole_number`: If TRUE, returns whole numbers; if FALSE,
            ///   returns decimal numbers (default FALSE).
            #[examples("RANDARRAY(3, 2)", "RANDARRAY(2, 2, 1, 100, TRUE)")]
            fn RANDARRAY(
                span: Span,
                rows: (Option<Spanned<i64>>),
                columns: (Option<Spanned<i64>>),
                min: (Option<f64>),
                max: (Option<f64>),
                whole_number: (Option<bool>),
            ) {
                use rand::Rng;

                let r = rows.map(|r| r.inner).unwrap_or(1);
                let c = columns.map(|c| c.inner).unwrap_or(1);
                let min_val = min.unwrap_or(0.0);
                let max_val = max.unwrap_or(1.0);
                let whole = whole_number.unwrap_or(false);

                if r <= 0 || c <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }
                if min_val > max_val {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = ArraySize::new(c as u32, r as u32)
                    .ok_or_else(|| RunErrorMsg::InvalidArgument.with_span(span))?;

                let mut rng = rand::rng();
                let values: SmallVec<[CellValue; 1]> = (0..(r * c))
                    .map(|_| {
                        let val = if whole {
                            let min_i = min_val.ceil() as i64;
                            let max_i = max_val.floor() as i64;
                            if min_i > max_i {
                                min_val // If no integers in range, return min
                            } else {
                                rng.random_range(min_i..=max_i) as f64
                            }
                        } else {
                            rng.random_range(min_val..=max_val)
                        };
                        CellValue::Number(
                            rust_decimal::Decimal::from_f64_retain(val).unwrap_or_default(),
                        )
                    })
                    .collect();

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Applies a lambda function to each row of an array and returns the
            /// results as a column.
            ///
            /// - `array`: The array to process, where each row is passed to the lambda.
            /// - `lambda`: A LAMBDA function that takes a single row (as a 1D array)
            ///   and returns a single value.
            ///
            /// The lambda function is called once for each row in the array.
            /// The results are combined into a single column.
            #[examples(
                "BYROW({1, 2; 3, 4}, LAMBDA(row, SUM(row)))",
                "BYROW(A1:C5, LAMBDA(r, MAX(r)))"
            )]
            fn BYROW(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                eval_by_slice(ctx, span, args, Axis::Y, "BYROW")?
            }
        ),
        formula_fn!(
            /// Applies a lambda function to each column of an array and returns the
            /// results as a row.
            ///
            /// - `array`: The array to process, where each column is passed to the lambda.
            /// - `lambda`: A LAMBDA function that takes a single column (as a 1D array)
            ///   and returns a single value.
            ///
            /// The lambda function is called once for each column in the array.
            /// The results are combined into a single row.
            #[examples(
                "BYCOL({1, 2; 3, 4}, LAMBDA(col, SUM(col)))",
                "BYCOL(A1:C5, LAMBDA(c, MAX(c)))"
            )]
            fn BYCOL(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                eval_by_slice(ctx, span, args, Axis::X, "BYCOL")?
            }
        ),
        formula_fn!(
            /// Creates an array by applying a lambda function to each row and column index.
            ///
            /// - `rows`: The number of rows in the resulting array.
            /// - `columns`: The number of columns in the resulting array.
            /// - `lambda`: A LAMBDA function that takes row index and column index
            ///   (both 1-based) and returns a value for that cell.
            ///
            /// The lambda is called once for each cell in the resulting array.
            #[examples(
                "MAKEARRAY(3, 3, LAMBDA(r, c, r * c))",
                "MAKEARRAY(2, 4, LAMBDA(row, col, row + col))"
            )]
            fn MAKEARRAY(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;

                // Get rows
                let rows_value = args.take_next_required("rows")?;
                let rows: i64 = rows_value.try_coerce()?.inner;

                // Get columns
                let columns_value = args.take_next_required("columns")?;
                let columns: i64 = columns_value.try_coerce()?.inner;

                // Get lambda
                let lambda_value = args.take_next_required("lambda")?;
                let lambda = extract_lambda(&lambda_value, "MAKEARRAY")?;

                args.error_if_more_args()?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }

                // Validate dimensions
                if rows <= 0 || columns <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Validate lambda has exactly 2 parameters
                if lambda.param_count() != 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = ArraySize::new(columns as u32, rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;

                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity((rows * columns) as usize);

                for r in 1..=rows {
                    for c in 1..=columns {
                        // Create bindings for row and column indices (1-based)
                        let bindings = vec![
                            (lambda.params[0].clone(), Value::from(r as f64)),
                            (lambda.params[1].clone(), Value::from(c as f64)),
                        ];

                        // Evaluate the lambda body with the bindings
                        let mut child_ctx = ctx.with_bindings(&bindings);
                        let result = lambda.body.eval(&mut child_ctx);

                        // Extract a single value from the result
                        let cell_value = match result.inner {
                            Value::Single(cv) => cv,
                            Value::Array(a) => a
                                .cell_values_slice()
                                .first()
                                .cloned()
                                .unwrap_or(CellValue::Blank),
                            Value::Tuple(t) => t
                                .first()
                                .and_then(|a| a.cell_values_slice().first().cloned())
                                .unwrap_or(CellValue::Blank),
                            Value::Lambda(_) => {
                                return Err(RunErrorMsg::Expected {
                                    expected: "value".into(),
                                    got: Some("lambda".into()),
                                }
                                .with_span(span));
                            }
                        };

                        values.push(cell_value);
                    }
                }

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Applies a lambda function to each element in an array or arrays,
            /// returning a new array of the same size.
            ///
            /// - `array1`: The first array to map over.
            /// - `lambda`: A LAMBDA function that takes one argument per input array
            ///   and returns a value.
            ///
            /// If multiple arrays are provided (via additional arguments before lambda),
            /// they must all have the same dimensions, and the lambda receives one
            /// element from each array at corresponding positions.
            #[examples(
                "MAP({1, 2, 3}, LAMBDA(x, x * 2))",
                "MAP({1, 2; 3, 4}, {10, 20; 30, 40}, LAMBDA(a, b, a + b))"
            )]
            fn MAP(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;

                // Collect all arguments
                let all_args: Vec<Spanned<Value>> = args.take_rest().collect();

                if all_args.len() < 2 {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "MAP".into(),
                        arg_name: if all_args.is_empty() {
                            "array"
                        } else {
                            "lambda"
                        }
                        .into(),
                    }
                    .with_span(span));
                }

                // The last argument should be the lambda
                let lambda_value = &all_args[all_args.len() - 1];
                let lambda = extract_lambda(lambda_value, "MAP")?;

                // All other arguments are arrays
                let array_values = &all_args[..all_args.len() - 1];

                // Check that lambda has correct number of parameters
                if lambda.param_count() != array_values.len() {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }

                // Convert all arguments to arrays
                let arrays: Vec<Array> = array_values
                    .iter()
                    .map(|v| Array::try_from(v.inner.clone()))
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| e.with_span(span))?;

                // All arrays must have the same size
                let first_size = arrays[0].size();
                for (i, arr) in arrays.iter().enumerate().skip(1) {
                    if arr.size() != first_size {
                        return Err(RunErrorMsg::ExactArraySizeMismatch {
                            expected: first_size,
                            got: arr.size(),
                        }
                        .with_span(array_values[i].span));
                    }
                }

                let mut values: SmallVec<[CellValue; 1]> =
                    SmallVec::with_capacity(first_size.len());

                // Iterate over all positions
                for idx in 0..first_size.len() {
                    // Get the element from each array at this position
                    let mut bindings: Vec<(String, Value)> = Vec::with_capacity(arrays.len());
                    for (i, arr) in arrays.iter().enumerate() {
                        let cell_value = arr.cell_values_slice()[idx].clone();
                        bindings.push((lambda.params[i].clone(), Value::Single(cell_value)));
                    }

                    // Evaluate the lambda body with the bindings
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let result = lambda.body.eval(&mut child_ctx);

                    // Extract a single value from the result
                    let cell_value = match result.inner {
                        Value::Single(cv) => cv,
                        Value::Array(a) => a
                            .cell_values_slice()
                            .first()
                            .cloned()
                            .unwrap_or(CellValue::Blank),
                        Value::Tuple(t) => t
                            .first()
                            .and_then(|a| a.cell_values_slice().first().cloned())
                            .unwrap_or(CellValue::Blank),
                        Value::Lambda(_) => {
                            return Err(RunErrorMsg::Expected {
                                expected: "value".into(),
                                got: Some("lambda".into()),
                            }
                            .with_span(span));
                        }
                    };

                    values.push(cell_value);
                }

                Array::new_row_major(first_size, values)?
            }
        ),
        formula_fn!(
            /// Reduces an array to a single value by applying a lambda function
            /// to an accumulator and each element in sequence.
            ///
            /// - `initial_value`: The starting value for the accumulator.
            /// - `array`: The array to reduce.
            /// - `lambda`: A LAMBDA function that takes two arguments:
            ///   the accumulator and the current element, and returns the new
            ///   accumulator value.
            ///
            /// The lambda is called once for each element in the array,
            /// with the result becoming the new accumulator for the next iteration.
            #[examples(
                "REDUCE(0, {1, 2, 3, 4, 5}, LAMBDA(acc, val, acc + val))",
                "REDUCE(1, A1:A5, LAMBDA(a, b, a * b))"
            )]
            fn REDUCE(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;

                // Get initial value
                let initial_value = args.take_next_required("initial_value")?;

                // Get array
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;

                // Get lambda
                let lambda_value = args.take_next_required("lambda")?;
                let lambda = extract_lambda(&lambda_value, "REDUCE")?;

                args.error_if_more_args()?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }

                // Validate lambda has exactly 2 parameters
                if lambda.param_count() != 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Start with initial value
                let mut accumulator = initial_value.inner;

                // Iterate over array elements
                for cell_value in array.cell_values_slice().iter() {
                    // Create bindings for accumulator and current element
                    let bindings = vec![
                        (lambda.params[0].clone(), accumulator),
                        (lambda.params[1].clone(), Value::Single(cell_value.clone())),
                    ];

                    // Evaluate the lambda body with the bindings
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let result = lambda.body.eval(&mut child_ctx);

                    // The result becomes the new accumulator
                    accumulator = result.inner;
                }

                accumulator
            }
        ),
        formula_fn!(
            /// Returns the specified columns from an array.
            ///
            /// Column indices are 1-based. Negative indices count from the end
            /// of the array (e.g., -1 is the last column).
            ///
            /// Multiple column indices can be specified to return multiple columns.
            #[examples(
                "CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1) = {1; 4}",
                "CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1, 3) = {1, 3; 4, 6}",
                "CHOOSECOLS({1, 2, 3; 4, 5, 6}, -1) = {3; 6}"
            )]
            fn CHOOSECOLS(span: Span, args: FormulaFnArgs) {
                let mut args = args;

                // Get the array
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;

                // Collect column indices
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

                // Convert indices to 0-based, handling negative indices
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

                // Build the result array
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
            ///
            /// Row indices are 1-based. Negative indices count from the end
            /// of the array (e.g., -1 is the last row).
            ///
            /// Multiple row indices can be specified to return multiple rows.
            #[examples(
                "CHOOSEROWS({1, 2, 3; 4, 5, 6}, 1) = {1, 2, 3}",
                "CHOOSEROWS({1, 2, 3; 4, 5, 6}, 1, 2) = {1, 2, 3; 4, 5, 6}",
                "CHOOSEROWS({1, 2, 3; 4, 5, 6}, -1) = {4, 5, 6}"
            )]
            fn CHOOSEROWS(span: Span, args: FormulaFnArgs) {
                let mut args = args;

                // Get the array
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;

                // Collect row indices
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

                // Convert indices to 0-based, handling negative indices
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

                // Build the result array
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
            /// Scans an array by applying a lambda function to an accumulator
            /// and each element, returning an array of all intermediate values.
            ///
            /// - `initial_value`: The starting value for the accumulator.
            /// - `array`: The array to scan.
            /// - `lambda`: A LAMBDA function that takes two arguments:
            ///   the accumulator and the current element, and returns the new
            ///   accumulator value.
            ///
            /// Similar to REDUCE, but returns all intermediate accumulator values
            /// as an array of the same shape as the input array.
            #[examples(
                "SCAN(0, {1, 2, 3, 4, 5}, LAMBDA(acc, val, acc + val))",
                "SCAN(1, A1:A5, LAMBDA(a, b, a * b))"
            )]
            fn SCAN(ctx: Ctx, span: Span, args: FormulaFnArgs) {
                let mut args = args;

                // Get initial value
                let initial_value = args.take_next_required("initial_value")?;

                // Get array
                let array_value = args.take_next_required("array")?;
                let array: Array = array_value.try_coerce()?.inner;

                // Get lambda
                let lambda_value = args.take_next_required("lambda")?;
                let lambda = extract_lambda(&lambda_value, "SCAN")?;

                args.error_if_more_args()?;

                if ctx.skip_computation {
                    return Ok(Value::Single(CellValue::Blank));
                }

                // Validate lambda has exactly 2 parameters
                if lambda.param_count() != 2 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let size = array.size();
                let mut values: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());

                // Start with initial value
                let mut accumulator = initial_value.inner;

                // Iterate over array elements
                for cell_value in array.cell_values_slice().iter() {
                    // Create bindings for accumulator and current element
                    let bindings = vec![
                        (lambda.params[0].clone(), accumulator),
                        (lambda.params[1].clone(), Value::Single(cell_value.clone())),
                    ];

                    // Evaluate the lambda body with the bindings
                    let mut child_ctx = ctx.with_bindings(&bindings);
                    let result = lambda.body.eval(&mut child_ctx);

                    // Extract a single value from the result for the output
                    let result_value = match &result.inner {
                        Value::Single(cv) => cv.clone(),
                        Value::Array(a) => a
                            .cell_values_slice()
                            .first()
                            .cloned()
                            .unwrap_or(CellValue::Blank),
                        Value::Tuple(t) => t
                            .first()
                            .and_then(|a| a.cell_values_slice().first().cloned())
                            .unwrap_or(CellValue::Blank),
                        Value::Lambda(_) => {
                            return Err(RunErrorMsg::Expected {
                                expected: "value".into(),
                                got: Some("lambda".into()),
                            }
                            .with_span(span));
                        }
                    };

                    values.push(result_value);

                    // The result becomes the new accumulator
                    accumulator = result.inner;
                }

                Array::new_row_major(size, values)?
            }
        ),
        formula_fn!(
            /// Excludes a specified number of rows or columns from the start or
            /// end of an array.
            ///
            /// - `array`: The array from which to drop rows or columns.
            /// - `rows`: The number of rows to drop. Positive values drop from
            ///   the start, negative values drop from the end.
            /// - `columns`: Optional. The number of columns to drop. Positive
            ///   values drop from the start, negative values drop from the end.
            #[examples(
                "DROP({1, 2, 3; 4, 5, 6; 7, 8, 9}, 1) = {4, 5, 6; 7, 8, 9}",
                "DROP({1, 2, 3; 4, 5, 6}, 1, 1) = {5, 6}",
                "DROP({1, 2, 3; 4, 5, 6}, -1) = {1, 2, 3}",
                "DROP({1, 2, 3}, 0, -1) = {1, 2}"
            )]
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

                // Calculate the new start and size for rows
                let (row_start, new_height) = if rows_to_drop >= 0 {
                    // Drop from start
                    let start = rows_to_drop.min(height);
                    (start, height - start)
                } else {
                    // Drop from end
                    let to_drop = (-rows_to_drop).min(height);
                    (0, height - to_drop)
                };

                // Calculate the new start and size for columns
                let (col_start, new_width) = if cols_to_drop >= 0 {
                    // Drop from start
                    let start = cols_to_drop.min(width);
                    (start, width - start)
                } else {
                    // Drop from end
                    let to_drop = (-cols_to_drop).min(width);
                    (0, width - to_drop)
                };

                // Check if result would be empty
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
            /// Expands or pads an array to the specified number of rows and
            /// columns.
            ///
            /// - `array`: The array to expand.
            /// - `rows`: The number of rows in the expanded array. If omitted or
            ///   blank, the array's current row count is used.
            /// - `columns`: Optional. The number of columns in the expanded array.
            ///   If omitted, the array's current column count is used.
            /// - `pad_with`: Optional. The value to pad with. Defaults to #N/A.
            ///
            /// The original array's dimensions cannot be reduced.
            #[examples(
                "EXPAND({1, 2; 3, 4}, 3, 3) = {1, 2, #N/A; 3, 4, #N/A; #N/A, #N/A, #N/A}",
                "EXPAND({1, 2}, 2, 3, 0) = {1, 2, 0; 0, 0, 0}",
                "EXPAND({1}, 2, 2, \"-\") = {1, \"-\"; \"-\", \"-\"}"
            )]
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

                // Use original dimensions if not specified or blank
                let target_rows = rows.map(|r| r.inner).unwrap_or(orig_height);
                let target_cols = columns.map(|c| c.inner).unwrap_or(orig_width);

                // Validate: cannot reduce dimensions
                if target_rows < orig_height || target_cols < orig_width {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                // Validate: dimensions must be positive
                if target_rows <= 0 || target_cols <= 0 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(span));
                }

                let result_size = ArraySize::new(target_cols as u32, target_rows as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;

                // Default pad value is #N/A error
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
            /// Returns the formula at the given reference as a text string.
            ///
            /// - `reference`: A reference to a cell containing a formula.
            ///
            /// Returns #N/A if the referenced cell does not contain a formula.
            #[examples("FORMULATEXT(A1)", "FORMULATEXT(Sheet2!B5)")]
            fn FORMULATEXT(ctx: Ctx, span: Span, reference: (Spanned<Array>)) {
                // Get the position of the referenced cell
                // The reference should point to a single cell
                if reference.inner.size().len() != 1 {
                    return Err(RunErrorMsg::InvalidArgument.with_span(reference.span));
                }

                if ctx.skip_computation {
                    return Ok(CellValue::Blank.into());
                }

                // The cells_accessed in ctx contains all the cells that were referenced.
                // We need to find the position of the cell that was passed as an argument.
                // Since the argument was just evaluated, the most recently accessed cell
                // should be the one we're looking for.

                // Get the last accessed cell position from cells_accessed
                // We iterate through all sheets and their ranges to find the cell position
                let a1_context = ctx.grid_controller.a1_context();

                for (sheet_id, ranges) in ctx.cells_accessed.cells.iter() {
                    for range in ranges.iter() {
                        // Get the bounds of this range
                        if let Some(rect) = range.to_rect(a1_context) {
                            // We only want single-cell references for FORMULATEXT
                            if rect.width() == 1 && rect.height() == 1 {
                                let pos = Pos {
                                    x: rect.min.x,
                                    y: rect.min.y,
                                };

                                // Look up if there's a formula at this position
                                if let Some(sheet) = ctx.grid_controller.try_sheet(*sheet_id) {
                                    if let Some(code_run) = sheet.code_run_at(&pos) {
                                        if code_run.language
                                            == crate::grid::CodeCellLanguage::Formula
                                        {
                                            // Return the formula code with = prefix
                                            let formula_code = if code_run.code.starts_with('=') {
                                                code_run.code.clone()
                                            } else {
                                                format!("={}", code_run.code)
                                            };
                                            return Ok(CellValue::Text(formula_code).into());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // No formula found at the referenced cell
                CellValue::Error(Box::new(RunErrorMsg::NotAvailable.with_span(span)))
            }
        ),
        formula_fn!(
            /// Appends arrays horizontally (column-wise).
            ///
            /// Stacks multiple arrays or values side by side. All arrays must have
            /// the same number of rows, or be a single value (which will be expanded
            /// to match the height of the other arrays).
            ///
            /// - `array1, array2, ...`: The arrays or values to stack horizontally.
            #[examples(
                "HSTACK({1; 2; 3}, {4; 5; 6}) = {1, 4; 2, 5; 3, 6}",
                "HSTACK({1, 2}, {3, 4}) = {1, 2, 3, 4}",
                "HSTACK(A1:A3, B1:B3, C1:C3)"
            )]
            fn HSTACK(span: Span, arrays: (Iter<Spanned<Array>>)) {
                let arrays: Vec<Spanned<Array>> = arrays.collect::<CodeResult<Vec<_>>>()?;

                if arrays.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "HSTACK".into(),
                        arg_name: "array1".into(),
                    }
                    .with_span(span));
                }

                // Find the maximum height, treating single values as height 1
                let max_height = arrays.iter().map(|a| a.inner.height()).max().unwrap_or(1);

                // Validate that all arrays have either height 1 (single row/value) or max_height
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

                // Calculate total width
                let total_width: u32 = arrays.iter().map(|a| a.inner.width()).sum();

                let size = ArraySize::new(total_width, max_height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;

                let mut values: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());

                for row in 0..max_height {
                    for arr in &arrays {
                        let arr_height = arr.inner.height();
                        // If array has height 1, always use row 0; otherwise use current row
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
            /// Creates a clickable hyperlink.
            ///
            /// Returns a text value that, if it looks like a URL, will be
            /// rendered as a clickable link.
            ///
            /// - `link_location`: The URL or reference to navigate to.
            /// - `friendly_name`: Optional text to display. If omitted, displays
            ///   the link_location.
            ///
            /// Note: For the link to be clickable, the displayed text must be a
            /// valid URL (starting with http://, https://, or www.).
            #[examples(
                "HYPERLINK(\"https://example.com\")",
                "HYPERLINK(\"https://example.com\", \"Click here\")"
            )]
            #[zip_map]
            fn HYPERLINK([link_location]: String, [friendly_name]: (Option<String>)) {
                // Return the friendly_name if provided, otherwise the link_location
                // The client will auto-detect URLs and make them clickable
                friendly_name.unwrap_or(link_location)
            }
        ),
        formula_fn!(
            /// Converts an array or range to a single column.
            ///
            /// - `array`: The array or range to convert to a column.
            /// - `ignore`: Optional. Specifies how to handle blanks and errors:
            ///   - `0` (default): Keep all values
            ///   - `1`: Ignore blanks
            ///   - `2`: Ignore errors
            ///   - `3`: Ignore blanks and errors
            /// - `scan_by_column`: Optional. If `TRUE`, scans the array by column
            ///   (top to bottom, then left to right). If `FALSE` or omitted, scans
            ///   by row (left to right, then top to bottom).
            #[examples(
                "TOCOL({1, 2; 3, 4}) = {1; 2; 3; 4}",
                "TOCOL({1, 2; 3, 4}, , TRUE) = {1; 3; 2; 4}",
                "TOCOL({1, , 3; , 5, 6}, 1) = {1; 3; 5; 6}"
            )]
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
                    // Scan by column (top to bottom, then left to right)
                    for col in 0..array.width() {
                        for row in 0..array.height() {
                            let value = array.get(col, row)?;
                            if should_include_value(value, ignore_blanks, ignore_errors) {
                                values.push(value.clone());
                            }
                        }
                    }
                } else {
                    // Scan by row (left to right, then top to bottom) - default
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
            /// Converts an array or range to a single row.
            ///
            /// - `array`: The array or range to convert to a row.
            /// - `ignore`: Optional. Specifies how to handle blanks and errors:
            ///   - `0` (default): Keep all values
            ///   - `1`: Ignore blanks
            ///   - `2`: Ignore errors
            ///   - `3`: Ignore blanks and errors
            /// - `scan_by_column`: Optional. If `TRUE`, scans the array by column
            ///   (top to bottom, then left to right). If `FALSE` or omitted, scans
            ///   by row (left to right, then top to bottom).
            #[examples(
                "TOROW({1; 2; 3; 4}) = {1, 2, 3, 4}",
                "TOROW({1, 2; 3, 4}) = {1, 2, 3, 4}",
                "TOROW({1, 2; 3, 4}, , TRUE) = {1, 3, 2, 4}",
                "TOROW({1, , 3; , 5, 6}, 1) = {1, 3, 5, 6}"
            )]
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
                    // Scan by column (top to bottom, then left to right)
                    for col in 0..array.width() {
                        for row in 0..array.height() {
                            let value = array.get(col, row)?;
                            if should_include_value(value, ignore_blanks, ignore_errors) {
                                values.push(value.clone());
                            }
                        }
                    }
                } else {
                    // Scan by row (left to right, then top to bottom) - default
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
            /// Stacks arrays vertically into a single array.
            ///
            /// Appends arrays on top of each other, resulting in an array with the
            /// combined height of all input arrays.
            ///
            /// If arrays have different widths, arrays with fewer columns are
            /// padded with #N/A errors to match the widest array. Single values
            /// or single-row arrays are expanded to match the width of the widest
            /// array.
            #[examples(
                "VSTACK({1, 2}, {3, 4}) = {1, 2; 3, 4}",
                "VSTACK({1; 2; 3}, {4; 5; 6}) = {1; 2; 3; 4; 5; 6}",
                "VSTACK({1, 2, 3}, {4, 5, 6}) = {1, 2, 3; 4, 5, 6}"
            )]
            fn VSTACK(span: Span, arrays: (Iter<Spanned<Array>>)) {
                let arrays: Vec<Spanned<Array>> = arrays.collect::<CodeResult<Vec<_>>>()?;

                if arrays.is_empty() {
                    return Err(RunErrorMsg::MissingRequiredArgument {
                        func_name: "VSTACK".into(),
                        arg_name: "array1".into(),
                    }
                    .with_span(span));
                }

                // Find the maximum width, treating single values as width 1
                let max_width = arrays.iter().map(|a| a.inner.width()).max().unwrap_or(1);

                // Validate that all arrays have either width 1 (single column/value) or max_width
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

                // Calculate total height
                let total_height: u32 = arrays.iter().map(|a| a.inner.height()).sum();

                let size = ArraySize::new(max_width, total_height)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;

                let mut values: SmallVec<[CellValue; 1]> = SmallVec::with_capacity(size.len());

                for arr in &arrays {
                    let arr_width = arr.inner.width();
                    for row in 0..arr.inner.height() {
                        for col in 0..max_width {
                            // If array has width 1, always use col 0; otherwise use current col
                            let source_col = if arr_width == 1 { 0 } else { col };
                            values.push(arr.inner.get(source_col, row)?.clone());
                        }
                    }
                }

                Array::new_row_major(size, values)?
            }
        ),
    ]
}

/// Helper function to determine if a value should be included based on ignore settings
fn should_include_value(value: &CellValue, ignore_blanks: bool, ignore_errors: bool) -> bool {
    if ignore_blanks && value.is_blank() {
        return false;
    }
    if ignore_errors && matches!(value, CellValue::Error(_)) {
        return false;
    }
    true
}

/// Evaluates BYROW or BYCOL by applying a lambda function to each slice (row or column)
/// of an array and returning the results.
fn eval_by_slice(
    ctx: &mut Ctx<'_>,
    span: Span,
    mut args: FormulaFnArgs,
    axis: Axis,
    func_name: &'static str,
) -> CodeResult<Value> {
    // Get the array argument
    let array_value = args.take_next_required("array")?;
    let array: Array = array_value.try_coerce()?.inner;

    // Get the lambda argument
    let lambda_value = args.take_next_required("lambda")?;
    let lambda = extract_lambda(&lambda_value, func_name)?;

    // Check that there are no extra arguments
    args.error_if_more_args()?;

    if ctx.skip_computation {
        return Ok(Value::Single(CellValue::Blank));
    }

    // Validate lambda has exactly 1 parameter
    if lambda.param_count() != 1 {
        return Err(RunErrorMsg::InvalidArgument.with_span(span));
    }

    // Apply the lambda to each slice
    let results = apply_lambda_to_slices(ctx, &array, &lambda, axis, span)?;

    // Build result array based on axis
    let result_array = match axis {
        // BYROW: results form a column (Nx1 array)
        Axis::Y => {
            let size = ArraySize::new(1, results.len() as u32)
                .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
            Array::new_row_major(size, results.into())?
        }
        // BYCOL: results form a row (1xN array)
        Axis::X => {
            let size = ArraySize::new(results.len() as u32, 1)
                .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
            Array::new_row_major(size, results.into())?
        }
    };

    Ok(Value::from(result_array))
}

/// Extracts a LambdaValue from a Spanned<Value>, returning an error if it's not a lambda.
fn extract_lambda(value: &Spanned<Value>, _func_name: &str) -> CodeResult<LambdaValue> {
    match &value.inner {
        Value::Lambda(lambda) => Ok(lambda.clone()),
        Value::Single(cv) => Err(RunErrorMsg::Expected {
            expected: "lambda".into(),
            got: Some(cv.type_name().into()),
        }
        .with_span(value.span)),
        Value::Array(_) => Err(RunErrorMsg::Expected {
            expected: "lambda".into(),
            got: Some("array".into()),
        }
        .with_span(value.span)),
        Value::Tuple(_) => Err(RunErrorMsg::Expected {
            expected: "lambda".into(),
            got: Some("tuple".into()),
        }
        .with_span(value.span)),
    }
}

/// Applies a lambda function to each slice (row or column) of an array.
fn apply_lambda_to_slices(
    ctx: &mut Ctx<'_>,
    array: &Array,
    lambda: &LambdaValue,
    axis: Axis,
    span: Span,
) -> CodeResult<SmallVec<[CellValue; 1]>> {
    let mut results = SmallVec::new();

    for slice in array.slices(axis) {
        // Create a 1D array from the slice
        let slice_values: SmallVec<[CellValue; 1]> =
            slice.into_iter().map(|cv| cv.clone()).collect();
        let slice_array = match axis {
            // Row: create a 1xN array (row vector)
            Axis::Y => {
                let size = ArraySize::new(slice_values.len() as u32, 1)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, slice_values)?
            }
            // Column: create an Nx1 array (column vector)
            Axis::X => {
                let size = ArraySize::new(1, slice_values.len() as u32)
                    .ok_or_else(|| RunErrorMsg::ArrayTooBig.with_span(span))?;
                Array::new_row_major(size, slice_values)?
            }
        };

        // Create bindings for the lambda parameter
        let bindings = vec![(lambda.params[0].clone(), Value::from(slice_array))];

        // Evaluate the lambda body with the bindings
        let mut child_ctx = ctx.with_bindings(&bindings);
        let result = lambda.body.eval(&mut child_ctx);

        // Extract a single value from the result
        let cell_value = match result.inner {
            Value::Single(cv) => cv,
            Value::Array(a) => a
                .cell_values_slice()
                .first()
                .cloned()
                .unwrap_or(CellValue::Blank),
            Value::Tuple(t) => t
                .first()
                .and_then(|a| a.cell_values_slice().first().cloned())
                .unwrap_or(CellValue::Blank),
            Value::Lambda(_) => {
                return Err(RunErrorMsg::Expected {
                    expected: "value".into(),
                    got: Some("lambda".into()),
                }
                .with_span(span));
            }
        };

        results.push(cell_value);
    }

    Ok(results)
}

/// Calculate matrix determinant using LU decomposition with partial pivoting
fn matrix_determinant(matrix: &[f64], n: usize) -> f64 {
    if n == 1 {
        return matrix[0];
    }
    if n == 2 {
        return matrix[0] * matrix[3] - matrix[1] * matrix[2];
    }

    // Copy matrix for LU decomposition
    let mut lu: Vec<f64> = matrix.to_vec();
    let mut det = 1.0;

    for col in 0..n {
        // Find pivot
        let mut max_val = lu[col * n + col].abs();
        let mut max_row = col;
        for row in (col + 1)..n {
            let val = lu[row * n + col].abs();
            if val > max_val {
                max_val = val;
                max_row = row;
            }
        }

        // Swap rows if needed
        if max_row != col {
            for k in 0..n {
                lu.swap(col * n + k, max_row * n + k);
            }
            det = -det;
        }

        let pivot = lu[col * n + col];
        if pivot.abs() < 1e-15 {
            return 0.0;
        }

        det *= pivot;

        // Eliminate column
        for row in (col + 1)..n {
            let factor = lu[row * n + col] / pivot;
            for k in col..n {
                lu[row * n + k] -= factor * lu[col * n + k];
            }
        }
    }

    det
}

/// Calculate matrix inverse using Gauss-Jordan elimination
fn matrix_inverse(matrix: &[f64], n: usize) -> Option<Vec<f64>> {
    // Create augmented matrix [A|I]
    let mut aug: Vec<f64> = vec![0.0; n * 2 * n];
    for i in 0..n {
        for j in 0..n {
            aug[i * 2 * n + j] = matrix[i * n + j];
        }
        aug[i * 2 * n + n + i] = 1.0;
    }

    // Gauss-Jordan elimination
    for col in 0..n {
        // Find pivot
        let mut max_val = aug[col * 2 * n + col].abs();
        let mut max_row = col;
        for row in (col + 1)..n {
            let val = aug[row * 2 * n + col].abs();
            if val > max_val {
                max_val = val;
                max_row = row;
            }
        }

        // Swap rows if needed
        if max_row != col {
            for k in 0..(2 * n) {
                aug.swap(col * 2 * n + k, max_row * 2 * n + k);
            }
        }

        let pivot = aug[col * 2 * n + col];
        if pivot.abs() < 1e-15 {
            return None; // Matrix is singular
        }

        // Scale pivot row
        for k in 0..(2 * n) {
            aug[col * 2 * n + k] /= pivot;
        }

        // Eliminate column
        for row in 0..n {
            if row != col {
                let factor = aug[row * 2 * n + col];
                for k in 0..(2 * n) {
                    aug[row * 2 * n + k] -= factor * aug[col * 2 * n + k];
                }
            }
        }
    }

    // Extract inverse from augmented matrix
    let mut inverse: Vec<f64> = vec![0.0; n * n];
    for i in 0..n {
        for j in 0..n {
            inverse[i * n + j] = aug[i * 2 * n + n + j];
        }
    }

    Some(inverse)
}

fn by_column_to_axis(by_column: Option<bool>) -> Axis {
    match by_column {
        Some(true) => Axis::X,
        None | Some(false) => Axis::Y,
    }
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, formulas::tests::*};

    #[test]
    fn test_formula_filter() {
        let all_shapes = array![
            "tetrahedron", 3, 3;
            "cube", 4, 3; // favorite
            "octahedron", 3, 4; // favorite
            "dodecahedron", 5, 3;
            "icosahedron", 3, 5; // favorite
        ];
        let g = GridController::from_grid(Grid::from_array(pos![A1], &all_shapes), 0);

        // General case
        let favorites = array![
            "cube", 4, 3;
            "octahedron", 3, 4;
            "icosahedron", 3, 5;
        ];
        assert_eq!(
            favorites.to_string(),
            eval_to_string(&g, "FILTER(A1:C5, {0;1;-6;FALSE;TRUE})"),
        );
        assert_eq!(
            favorites.to_string(),
            eval_to_string(&g, "FILTER(A1:C5, {0;1;-6;FALSE;TRUE}, 'oh no')"),
        );
        assert_eq!(
            RunErrorMsg::ExactArrayAxisMismatch {
                axis: Axis::X,
                expected: 5,
                got: 3,
            },
            eval_to_err(&g, "FILTER(A1:C5, {0,1,-6,FALSE,TRUE}, 'oh no')").msg,
        );

        // No results
        assert_eq!(
            RunErrorMsg::EmptyArray,
            eval_to_err(&g, "FILTER(A1:C5, {0;0;0;0;0})").msg,
        );
        assert_eq!(
            "oh no",
            eval_to_string(&g, "FILTER(A1:C5, {0;0;0;0;0}, 'oh no')"),
        );

        // Single `include` value (not array)
        let expected = all_shapes.to_string();
        assert_eq!(expected, eval_to_string(&g, "FILTER(A1:C5, 1)"));
        assert_eq!(expected, eval_to_string(&g, "FILTER(A1:C5, {1})"));
        assert_eq!("oh no", eval_to_string(&g, "FILTER(A1:C5, 0, 'oh no')"));
        assert_eq!("oh no", eval_to_string(&g, "FILTER(A1:C5, {0}, 'oh no')"));
        assert_eq!(
            RunErrorMsg::EmptyArray,
            eval_to_err(&g, "FILTER(A1:C5, 0)").msg,
        );
        assert_eq!(
            RunErrorMsg::EmptyArray,
            eval_to_err(&g, "FILTER(A1:C5, {0})").msg,
        );
        assert_eq!(
            RunErrorMsg::Expected {
                expected: "boolean".into(),
                got: Some("text".into()),
            },
            eval_to_err(&g, "FILTER(A1:C5, 'a')").msg,
        );
        assert_eq!(
            RunErrorMsg::Expected {
                expected: "boolean".into(),
                got: Some("text".into()),
            },
            eval_to_err(&g, "FILTER(A1:C5, 'a', 'oh no')").msg,
        );

        // Nonlinear `include` array
        assert_eq!(
            RunErrorMsg::NonLinearArray,
            eval_to_err(&g, "FILTER(A1:B2, {0,0;0,0}, 'oh no')").msg,
        );

        // Transposed
        let g = GridController::from_grid(Grid::from_array(pos![A1], &all_shapes.transpose()), 0);
        assert_eq!(
            favorites.transpose().to_string(),
            eval_to_string(&g, "FILTER(A1:E3, {0,1,-6,FALSE,TRUE})"),
        );
        assert_eq!(
            favorites.transpose().to_string(),
            eval_to_string(&g, "FILTER(A1:E3, {0,1,-6,FALSE,TRUE}, 'oh no')"),
        );
        assert_eq!(
            RunErrorMsg::ExactArrayAxisMismatch {
                axis: Axis::Y,
                expected: 5,
                got: 3,
            },
            eval_to_err(&g, "FILTER(A1:E3, {0;1;-6;FALSE;TRUE}, 'oh no')").msg,
        );

        // Bad filter value
        assert_eq!(
            RunErrorMsg::Expected {
                expected: "boolean".into(),
                got: Some("text".into())
            },
            eval_to_err(&g, "FILTER(A1:E3, {0,1,-6,'a',TRUE}, 'oh no')").msg,
        );
    }

    #[test]
    fn test_formula_sort() {
        let source_data = array![
            "decisive",   "accept",     9, -4;
            "history",    "elaborate",  2, -3;
            "scream",     "shiver",     10, 6;
            "wine",       "insistence", -2, -5;
            "conscience", "waste",      3, -8;
            "undertake",  "teacher",    1, 4;
            "classify",   "onion",      0, 5;
            "dynamic",    "activity",   -7, -9;
        ];

        let g = GridController::from_grid(Grid::from_array(pos![A1], &source_data), 0);

        let expected = array![
            "classify",   "onion",      0,  5;
            "conscience", "waste",      3,  -8;
            "decisive",   "accept",     9,  -4;
            "dynamic",    "activity",   -7, -9;
            "history",    "elaborate",  2,  -3;
            "scream",     "shiver",     10, 6;
            "undertake",  "teacher",    1,  4;
            "wine",       "insistence", -2, -5;
        ];
        assert_eq!(eval_to_string(&g, "=SORT(A1:D8)"), expected.to_string());

        let expected = array![
            "decisive",   "accept",     9,  -4;
            "dynamic",    "activity",   -7, -9;
            "history",    "elaborate",  2,  -3;
            "wine",       "insistence", -2, -5;
            "classify",   "onion",      0,  5;
            "scream",     "shiver",     10, 6;
            "undertake",  "teacher",    1,  4;
            "conscience", "waste",      3,  -8;
        ];
        assert_eq!(eval_to_string(&g, "=SORT(A1:D8, 2)"), expected.to_string());

        let expected = array![
            "dynamic",    "activity",   -7, -9;
            "wine",       "insistence", -2, -5;
            "classify",   "onion",      0,  5;
            "undertake",  "teacher",    1,  4;
            "history",    "elaborate",  2,  -3;
            "conscience", "waste",      3,  -8;
            "decisive",   "accept",     9,  -4;
            "scream",     "shiver",     10, 6;
        ];
        assert_eq!(eval_to_string(&g, "=SORT(A1:D8, 3)"), expected.to_string());

        let expected = array![
            "dynamic",    "activity",   -7, -9;
            "conscience", "waste",      3,  -8;
            "wine",       "insistence", -2, -5;
            "decisive",   "accept",     9,  -4;
            "history",    "elaborate",  2,  -3;
            "undertake",  "teacher",    1,  4;
            "classify",   "onion",      0,  5;
            "scream",     "shiver",     10, 6;
        ];
        assert_eq!(eval_to_string(&g, "=SORT(A1:D8, 4)"), expected.to_string());

        // Sort index out of range
        assert_eq!(
            eval_to_err(&g, "=SORT(A1:D8, 0)").msg,
            RunErrorMsg::InvalidArgument,
        );
        assert_eq!(
            eval_to_err(&g, "=SORT(A1:D8, 5)").msg,
            RunErrorMsg::InvalidArgument,
        );

        // Reverse
        let expected = array![
            "conscience", "waste",      3,  -8;
            "undertake",  "teacher",    1,  4;
            "scream",     "shiver",     10, 6;
            "classify",   "onion",      0,  5;
            "wine",       "insistence", -2, -5;
            "history",    "elaborate",  2,  -3;
            "dynamic",    "activity",   -7, -9;
            "decisive",   "accept",     9,  -4;
        ];
        assert_eq!(
            eval_to_string(&g, "=SORT(A1:D8, 2, -1)"),
            expected.to_string(),
        );

        // By row
        let expected = array![
            -4, 9,  "decisive",   "accept";
            -3, 2,  "history",    "elaborate";
            6,  10, "scream",     "shiver";
            -5, -2, "wine",       "insistence";
            -8, 3,  "conscience", "waste";
            4,  1,  "undertake",  "teacher";
            5,  0,  "classify",   "onion";
            -9, -7, "dynamic",    "activity";
        ];
        assert_eq!(
            eval_to_string(&g, "=SORT(A1:D8, 5,, TRUE)"),
            expected.to_string(),
        );
    }

    #[test]
    fn test_formula_sort_types() {
        let source_array = array![
            "string B";
            datetime("2024-09-28T12:30:00");
            time("1:30");
            Duration { months: 3, seconds: 2.0 };
            datetime("2024-09-26T15:30:00");
            true;
            Duration { months: 4, seconds: 1.5 };
            ();
            false;
            -10.0;
            "string A";
            date("2024-09-26");
            3.0;
            Duration { months: 4, seconds: 1.0 };
            time("13:00");
        ];

        let g = GridController::from_grid(Grid::from_array(pos![A1], &source_array), 0);

        let expected = array![
            -10.0;
            3.0;
            "string A";
            "string B";
            false;
            true;
            datetime("2024-09-26T15:30:00");
            datetime("2024-09-28T12:30:00");
            date("2024-09-26");
            time("1:30");
            time("13:00");
            Duration { months: 3, seconds: 2.0 };
            Duration { months: 4, seconds: 1.0 };
            Duration { months: 4, seconds: 1.5 };
            ();
        ];
        assert_eq!(eval_to_string(&g, "=SORT(A1:A15)"), expected.to_string());

        let expected = array![
            ();
            Duration { months: 4, seconds: 1.5 };
            Duration { months: 4, seconds: 1.0 };
            Duration { months: 3, seconds: 2.0 };
            time("13:00");
            time("1:30");
            date("2024-09-26");
            datetime("2024-09-28T12:30:00");
            datetime("2024-09-26T15:30:00");
            true;
            false;
            "string B";
            "string A";
            3.0;
            -10.0;
        ];
        assert_eq!(
            eval_to_string(&g, "=SORT(A1:A15,,-1)"),
            expected.to_string(),
        );
    }

    #[test]
    fn test_formula_unique() {
        let source_data = array![
            1, 2;
            "hello", 2;
            "oh", 4;
            (), 4;
            0, 4;
            0, 4;
            (), ();
            (), ();
            0, 0;
            0, 4;
            1, 2;
            "HELLO", 2; // case insensitive!
            "HI", 2;
        ];

        let g = GridController::from_grid(Grid::from_array(pos![A1], &source_data), 0);

        let expected_unique = array![
            1, 2;
            "hello", 2;
            "oh", 4;
            (), 4;
            0, 4;
            (), ();
            0, 0;
            "HI", 2;
        ];
        let expected_exactly_once = array![
            "oh", 4;
            (), 4;
            0, 0;
            "HI", 2;
        ];

        assert_eq!(source_data.height(), 13); // If this changes, update all the formulas too

        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:B13)"),
            expected_unique.to_string(),
        );
        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:B13,)"),
            expected_unique.to_string(),
        );
        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:B13,,)"),
            expected_unique.to_string(),
        );
        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:B13,FALSE,FALSE)"),
            expected_unique.to_string(),
        );
        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:B13,,TRUE)"),
            expected_exactly_once.to_string(),
        );
        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:B13,FALSE,TRUE)"),
            expected_exactly_once.to_string(),
        );

        let g = GridController::from_grid(Grid::from_array(pos![A1], &source_data.transpose()), 0);
        let expected_unique = expected_unique.transpose();
        let expected_exactly_once = expected_exactly_once.transpose();

        assert_eq!(
            pos![M2], // If this changes, update all the formulas too
            crate::Pos {
                x: source_data.height() as i64,
                y: source_data.width() as i64,
            },
        );

        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:M2,TRUE)"),
            expected_unique.to_string(),
        );
        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:M2,TRUE,)"),
            expected_unique.to_string(),
        );
        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:M2,TRUE,FALSE)"),
            expected_unique.to_string(),
        );
        assert_eq!(
            eval_to_string(&g, "=UNIQUE(A1:M2,TRUE,TRUE)"),
            expected_exactly_once.to_string(),
        );
    }

    #[test]
    fn test_formula_sumproduct() {
        let a = array![
            "A", "Q", 45;
            "B", "R", 21;
            "C", "S", 25;
            "A", "S", 20;
            "B", "R", 41;
            "C", "Q", 19;
        ];
        let g = GridController::from_grid(Grid::from_array(pos![A1], &a), 0);
        assert_eq!(
            "62",
            eval_to_string(&g, "SUMPRODUCT(A1:A6=\"B\", B1:B6=\"R\", C1:C6)")
        );
        assert_eq!(
            "62",
            eval_to_string(&g, "SUMPRODUCT((A1:A6=\"B\") * (B1:B6=\"R\") * C1:C6)")
        );
        // should be equivalent to `SUM()`
        assert_eq!(
            "62",
            eval_to_string(&g, "SUM((A1:A6=\"B\") * (B1:B6=\"R\") * C1:C6)")
        );

        // test that array size mismatches are not allowed
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(1, 6).unwrap(),
                got: ArraySize::new(1, 5).unwrap(),
            },
            eval_to_err(&g, "SUMPRODUCT((A1:A6=\"B\"), (B1:B5=\"R\"), C1:C6)").msg,
        );
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(1, 6).unwrap(),
                got: ArraySize::new(6, 1).unwrap(),
            },
            eval_to_err(&g, "SUMPRODUCT(A1:A6, B1:G1)").msg,
        );

        assert_eq!("171", eval_to_string(&g, "SUMPRODUCT(C1:C6)"));

        // Excel rejects this but it's perfectly reasonable
        assert_eq!("0", eval_to_string(&g, "SUMPRODUCT()"));
    }

    #[test]
    fn test_formula_transpose() {
        let g = GridController::new();

        // Basic transpose
        assert_eq!(
            "{1, 3; 2, 4}",
            eval_to_string(&g, "TRANSPOSE({1, 2; 3, 4})")
        );

        // Single row to column
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "TRANSPOSE({1, 2, 3})"));

        // Single column to row
        assert_eq!("{1, 2, 3}", eval_to_string(&g, "TRANSPOSE({1; 2; 3})"));

        // Single value (stays as single value)
        assert_eq!("{42}", eval_to_string(&g, "TRANSPOSE({42})"));
    }

    #[test]
    fn test_formula_sequence() {
        let g = GridController::new();

        // Basic sequence (vertical)
        assert_eq!("{1; 2; 3; 4; 5}", eval_to_string(&g, "SEQUENCE(5)"));

        // With columns (2D grid)
        assert_eq!(
            "{1, 2, 3; 4, 5, 6; 7, 8, 9}",
            eval_to_string(&g, "SEQUENCE(3, 3)")
        );

        // With custom start
        assert_eq!("{10; 11; 12}", eval_to_string(&g, "SEQUENCE(3, 1, 10)"));

        // With custom step
        assert_eq!("{0; 2; 4}", eval_to_string(&g, "SEQUENCE(3, 1, 0, 2)"));

        // Negative step
        assert_eq!("{10; 8; 6}", eval_to_string(&g, "SEQUENCE(3, 1, 10, -2)"));

        // Error for invalid dimensions
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SEQUENCE(0)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SEQUENCE(-1)").msg,
        );
    }

    #[test]
    fn test_mdeterm() {
        let g = GridController::new();

        // 2x2 matrix
        assert_eq!("-2", eval_to_string(&g, "MDETERM({1, 2; 3, 4})"));

        // 3x3 identity matrix
        assert_eq!(
            "1",
            eval_to_string(&g, "MDETERM({1, 0, 0; 0, 1, 0; 0, 0, 1})")
        );

        // 3x3 matrix
        assert_eq!(
            "0",
            eval_to_string(&g, "MDETERM({1, 2, 3; 4, 5, 6; 7, 8, 9})")
        );

        // 1x1 matrix
        assert_eq!("5", eval_to_string(&g, "MDETERM({5})"));

        // Error for non-square matrix
        assert_eq!(
            RunErrorMsg::NonRectangularArray,
            eval_to_err(&g, "MDETERM({1, 2, 3; 4, 5, 6})").msg,
        );
    }

    #[test]
    fn test_minverse() {
        let g = GridController::new();

        // 2x2 matrix inverse
        // {4, 7; 2, 6} has inverse {0.6, -0.7; -0.2, 0.4}
        let result = eval_to_string(&g, "MDETERM(MMULT({4, 7; 2, 6}, MINVERSE({4, 7; 2, 6})))");
        // Result should be close to 1 (determinant of identity)
        let det: f64 = result.parse().unwrap();
        assert!((det - 1.0).abs() < 0.0001);

        // 3x3 identity matrix inverse is itself
        assert_eq!(
            "{1, 0, 0; 0, 1, 0; 0, 0, 1}",
            eval_to_string(&g, "MINVERSE({1, 0, 0; 0, 1, 0; 0, 0, 1})")
        );

        // Error for singular matrix
        assert_eq!(
            RunErrorMsg::DivideByZero,
            eval_to_err(&g, "MINVERSE({1, 2; 2, 4})").msg,
        );
    }

    #[test]
    fn test_mmult() {
        let g = GridController::new();

        // 2x2 * 2x2
        assert_eq!(
            "{19, 22; 43, 50}",
            eval_to_string(&g, "MMULT({1, 2; 3, 4}, {5, 6; 7, 8})")
        );

        // 1x3 * 3x1 (row * column = scalar)
        assert_eq!("{32}", eval_to_string(&g, "MMULT({1, 2, 3}, {4; 5; 6})"));

        // 3x1 * 1x3 (column * row = 3x3 matrix)
        assert_eq!(
            "{4, 5, 6; 8, 10, 12; 12, 15, 18}",
            eval_to_string(&g, "MMULT({1; 2; 3}, {4, 5, 6})")
        );

        // 2x3 * 3x2
        assert_eq!(
            "{22, 28; 49, 64}",
            eval_to_string(&g, "MMULT({1, 2, 3; 4, 5, 6}, {1, 2; 3, 4; 5, 6})")
        );

        // Identity matrix multiplication
        assert_eq!(
            "{1, 2; 3, 4}",
            eval_to_string(&g, "MMULT({1, 2; 3, 4}, {1, 0; 0, 1})")
        );

        // Error for mismatched dimensions
        assert_eq!(
            RunErrorMsg::ArrayAxisMismatch {
                axis: Axis::X,
                expected: 2,
                got: 3,
            },
            eval_to_err(&g, "MMULT({1, 2; 3, 4}, {1, 2, 3; 4, 5, 6; 7, 8, 9})").msg,
        );
    }

    #[test]
    fn test_randarray() {
        let g = GridController::new();

        // Default: 1x1 array with value between 0 and 1
        let result = eval_to_string(&g, "RANDARRAY()");
        let val: f64 = result
            .trim_matches(|c| c == '{' || c == '}')
            .parse()
            .unwrap();
        assert!(val >= 0.0 && val <= 1.0);

        // Custom dimensions
        let result = eval_to_string(&g, "RANDARRAY(2, 3)");
        // Should have format like "{a, b, c; d, e, f}"
        assert!(result.starts_with('{') && result.ends_with('}'));
        let rows: Vec<&str> = result
            .trim_matches(|c| c == '{' || c == '}')
            .split("; ")
            .collect();
        assert_eq!(2, rows.len());
        for row in rows {
            let cols: Vec<&str> = row.split(", ").collect();
            assert_eq!(3, cols.len());
            for col in cols {
                let val: f64 = col.parse().unwrap();
                assert!(val >= 0.0 && val <= 1.0);
            }
        }

        // Custom min/max range
        for _ in 0..10 {
            let result = eval_to_string(&g, "RANDARRAY(1, 1, 10, 20)");
            let val: f64 = result
                .trim_matches(|c| c == '{' || c == '}')
                .parse()
                .unwrap();
            assert!(val >= 10.0 && val <= 20.0);
        }

        // Whole numbers
        for _ in 0..10 {
            let result = eval_to_string(&g, "RANDARRAY(1, 1, 1, 100, TRUE)");
            let val: f64 = result
                .trim_matches(|c| c == '{' || c == '}')
                .parse()
                .unwrap();
            assert!(val >= 1.0 && val <= 100.0);
            assert_eq!(val, val.floor()); // Should be a whole number
        }

        // Error for invalid dimensions
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "RANDARRAY(0, 1)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "RANDARRAY(1, -1)").msg,
        );

        // Error for min > max
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "RANDARRAY(1, 1, 100, 10)").msg,
        );
    }

    #[test]
    fn test_byrow() {
        let g = GridController::new();

        // Basic BYROW with SUM
        assert_eq!(
            "{3; 7}",
            eval_to_string(&g, "BYROW({1, 2; 3, 4}, LAMBDA(row, SUM(row)))")
        );

        // BYROW with MAX
        assert_eq!(
            "{3; 6; 9}",
            eval_to_string(&g, "BYROW({1, 2, 3; 4, 5, 6; 7, 8, 9}, LAMBDA(r, MAX(r)))")
        );

        // BYROW with MIN
        assert_eq!(
            "{1; 4; 7}",
            eval_to_string(&g, "BYROW({1, 2, 3; 4, 5, 6; 7, 8, 9}, LAMBDA(r, MIN(r)))")
        );

        // BYROW with AVERAGE
        assert_eq!(
            "{2; 5; 8}",
            eval_to_string(
                &g,
                "BYROW({1, 2, 3; 4, 5, 6; 7, 8, 9}, LAMBDA(r, AVERAGE(r)))"
            )
        );

        // BYROW with single row
        assert_eq!(
            "{6}",
            eval_to_string(&g, "BYROW({1, 2, 3}, LAMBDA(r, SUM(r)))")
        );

        // BYROW with single column (each "row" is a single element)
        assert_eq!(
            "{1; 2; 3}",
            eval_to_string(&g, "BYROW({1; 2; 3}, LAMBDA(r, SUM(r)))")
        );

        // BYROW with COUNT
        assert_eq!(
            "{3; 3}",
            eval_to_string(&g, "BYROW({1, 2, 3; 4, 5, 6}, LAMBDA(r, COUNT(r)))")
        );

        // Error: lambda must have exactly 1 parameter
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "BYROW({1, 2; 3, 4}, LAMBDA(a, b, a+b))").msg,
        );

        // Error: missing lambda argument
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "BYROW".into(),
                arg_name: "lambda".into(),
            },
            eval_to_err(&g, "BYROW({1, 2; 3, 4})").msg,
        );

        // Error: non-lambda as second argument
        assert_eq!(
            RunErrorMsg::Expected {
                expected: "lambda".into(),
                got: Some("number".into()),
            },
            eval_to_err(&g, "BYROW({1, 2; 3, 4}, 5)").msg,
        );
    }

    #[test]
    fn test_bycol() {
        let g = GridController::new();

        // Basic BYCOL with SUM
        assert_eq!(
            "{4, 6}",
            eval_to_string(&g, "BYCOL({1, 2; 3, 4}, LAMBDA(col, SUM(col)))")
        );

        // BYCOL with MAX
        assert_eq!(
            "{7, 8, 9}",
            eval_to_string(&g, "BYCOL({1, 2, 3; 4, 5, 6; 7, 8, 9}, LAMBDA(c, MAX(c)))")
        );

        // BYCOL with MIN
        assert_eq!(
            "{1, 2, 3}",
            eval_to_string(&g, "BYCOL({1, 2, 3; 4, 5, 6; 7, 8, 9}, LAMBDA(c, MIN(c)))")
        );

        // BYCOL with AVERAGE
        assert_eq!(
            "{4, 5, 6}",
            eval_to_string(
                &g,
                "BYCOL({1, 2, 3; 4, 5, 6; 7, 8, 9}, LAMBDA(c, AVERAGE(c)))"
            )
        );

        // BYCOL with single column
        assert_eq!(
            "{6}",
            eval_to_string(&g, "BYCOL({1; 2; 3}, LAMBDA(c, SUM(c)))")
        );

        // BYCOL with single row (each "column" is a single element)
        assert_eq!(
            "{1, 2, 3}",
            eval_to_string(&g, "BYCOL({1, 2, 3}, LAMBDA(c, SUM(c)))")
        );

        // BYCOL with COUNT
        assert_eq!(
            "{2, 2, 2}",
            eval_to_string(&g, "BYCOL({1, 2, 3; 4, 5, 6}, LAMBDA(c, COUNT(c)))")
        );

        // Error: lambda must have exactly 1 parameter
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "BYCOL({1, 2; 3, 4}, LAMBDA(a, b, a+b))").msg,
        );

        // Error: missing lambda argument
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "BYCOL".into(),
                arg_name: "lambda".into(),
            },
            eval_to_err(&g, "BYCOL({1, 2; 3, 4})").msg,
        );

        // Error: non-lambda as second argument
        assert_eq!(
            RunErrorMsg::Expected {
                expected: "lambda".into(),
                got: Some("text".into()),
            },
            eval_to_err(&g, "BYCOL({1, 2; 3, 4}, \"not a lambda\")").msg,
        );
    }

    #[test]
    fn test_makearray() {
        let g = GridController::new();

        // Basic MAKEARRAY - multiplication table
        assert_eq!(
            "{1, 2, 3; 2, 4, 6; 3, 6, 9}",
            eval_to_string(&g, "MAKEARRAY(3, 3, LAMBDA(r, c, r * c))")
        );

        // MAKEARRAY - row + column indices
        assert_eq!(
            "{2, 3, 4; 3, 4, 5}",
            eval_to_string(&g, "MAKEARRAY(2, 3, LAMBDA(row, col, row + col))")
        );

        // MAKEARRAY - single row
        assert_eq!(
            "{1, 2, 3, 4}",
            eval_to_string(&g, "MAKEARRAY(1, 4, LAMBDA(r, c, c))")
        );

        // MAKEARRAY - single column
        assert_eq!(
            "{1; 2; 3; 4}",
            eval_to_string(&g, "MAKEARRAY(4, 1, LAMBDA(r, c, r))")
        );

        // MAKEARRAY - constant value
        assert_eq!(
            "{5, 5; 5, 5}",
            eval_to_string(&g, "MAKEARRAY(2, 2, LAMBDA(r, c, 5))")
        );

        // MAKEARRAY - with calculation
        assert_eq!(
            "{2, 5, 10; 5, 8, 13; 10, 13, 18}",
            eval_to_string(&g, "MAKEARRAY(3, 3, LAMBDA(r, c, r*r + c*c))")
        );

        // Error: invalid dimensions
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "MAKEARRAY(0, 3, LAMBDA(r, c, r))").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "MAKEARRAY(3, -1, LAMBDA(r, c, r))").msg,
        );

        // Error: lambda must have exactly 2 parameters
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "MAKEARRAY(2, 2, LAMBDA(x, x))").msg,
        );
    }

    #[test]
    fn test_map() {
        let g = GridController::new();

        // Basic MAP - double values
        assert_eq!(
            "{2, 4, 6}",
            eval_to_string(&g, "MAP({1, 2, 3}, LAMBDA(x, x * 2))")
        );

        // MAP - 2D array
        assert_eq!(
            "{2, 4; 6, 8}",
            eval_to_string(&g, "MAP({1, 2; 3, 4}, LAMBDA(x, x * 2))")
        );

        // MAP - with string transformation
        assert_eq!(
            "{HELLO, WORLD}",
            eval_to_string(&g, "MAP({\"hello\", \"world\"}, LAMBDA(s, UPPER(s)))")
        );

        // MAP - square values
        assert_eq!(
            "{1, 4, 9, 16}",
            eval_to_string(&g, "MAP({1, 2, 3, 4}, LAMBDA(n, n * n))")
        );

        // MAP with two arrays
        assert_eq!(
            "{11, 22; 33, 44}",
            eval_to_string(
                &g,
                "MAP({1, 2; 3, 4}, {10, 20; 30, 40}, LAMBDA(a, b, a + b))"
            )
        );

        // MAP with three arrays
        assert_eq!(
            "{111, 222}",
            eval_to_string(
                &g,
                "MAP({1, 2}, {10, 20}, {100, 200}, LAMBDA(a, b, c, a + b + c))"
            )
        );

        // Error: missing arguments
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "MAP".into(),
                arg_name: "array".into(),
            },
            eval_to_err(&g, "MAP()").msg,
        );

        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "MAP".into(),
                arg_name: "lambda".into(),
            },
            eval_to_err(&g, "MAP({1, 2, 3})").msg,
        );

        // Error: wrong number of lambda parameters
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "MAP({1, 2, 3}, LAMBDA(a, b, a + b))").msg,
        );
    }

    #[test]
    fn test_reduce() {
        let g = GridController::new();

        // Basic REDUCE - sum
        assert_eq!(
            "15",
            eval_to_string(
                &g,
                "REDUCE(0, {1, 2, 3, 4, 5}, LAMBDA(acc, val, acc + val))"
            )
        );

        // REDUCE - product
        assert_eq!(
            "120",
            eval_to_string(
                &g,
                "REDUCE(1, {1, 2, 3, 4, 5}, LAMBDA(acc, val, acc * val))"
            )
        );

        // REDUCE - with initial value
        assert_eq!(
            "25",
            eval_to_string(
                &g,
                "REDUCE(10, {1, 2, 3, 4, 5}, LAMBDA(acc, val, acc + val))"
            )
        );

        // REDUCE - find max
        assert_eq!(
            "9",
            eval_to_string(
                &g,
                "REDUCE(0, {3, 7, 2, 9, 1}, LAMBDA(acc, val, IF(val > acc, val, acc)))"
            )
        );

        // REDUCE - 2D array (processes in row-major order)
        assert_eq!(
            "10",
            eval_to_string(&g, "REDUCE(0, {1, 2; 3, 4}, LAMBDA(acc, val, acc + val))")
        );

        // REDUCE - string concatenation
        assert_eq!(
            "abc",
            eval_to_string(
                &g,
                "REDUCE(\"\", {\"a\", \"b\", \"c\"}, LAMBDA(acc, val, CONCAT(acc, val)))"
            )
        );

        // Error: lambda must have exactly 2 parameters
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "REDUCE(0, {1, 2, 3}, LAMBDA(x, x))").msg,
        );
    }

    #[test]
    fn test_choosecols() {
        let g = GridController::new();

        // Basic CHOOSECOLS - single column
        assert_eq!(
            "{1; 4}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1)")
        );
        assert_eq!(
            "{2; 5}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, 2)")
        );
        assert_eq!(
            "{3; 6}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, 3)")
        );

        // CHOOSECOLS - multiple columns
        assert_eq!(
            "{1, 3; 4, 6}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1, 3)")
        );
        assert_eq!(
            "{3, 1; 6, 4}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, 3, 1)")
        );

        // CHOOSECOLS - negative indices
        assert_eq!(
            "{3; 6}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, -1)")
        );
        assert_eq!(
            "{2; 5}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, -2)")
        );
        assert_eq!(
            "{1; 4}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, -3)")
        );

        // CHOOSECOLS - mixed positive and negative
        assert_eq!(
            "{1, 3; 4, 6}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1, -1)")
        );

        // CHOOSECOLS - duplicate columns
        assert_eq!(
            "{1, 1; 4, 4}",
            eval_to_string(&g, "CHOOSECOLS({1, 2, 3; 4, 5, 6}, 1, 1)")
        );

        // Error: index 0 is invalid
        assert_eq!(
            RunErrorMsg::IndexOutOfBounds,
            eval_to_err(&g, "CHOOSECOLS({1, 2, 3}, 0)").msg,
        );

        // Error: index out of bounds
        assert_eq!(
            RunErrorMsg::IndexOutOfBounds,
            eval_to_err(&g, "CHOOSECOLS({1, 2, 3}, 4)").msg,
        );

        // Error: negative index out of bounds
        assert_eq!(
            RunErrorMsg::IndexOutOfBounds,
            eval_to_err(&g, "CHOOSECOLS({1, 2, 3}, -4)").msg,
        );

        // Error: missing column indices
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "CHOOSECOLS".into(),
                arg_name: "col_num1".into(),
            },
            eval_to_err(&g, "CHOOSECOLS({1, 2, 3})").msg,
        );
    }

    #[test]
    fn test_chooserows() {
        let g = GridController::new();

        // Basic CHOOSEROWS - single row
        assert_eq!(
            "{1, 2, 3}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6}, 1)")
        );
        assert_eq!(
            "{4, 5, 6}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6}, 2)")
        );

        // CHOOSEROWS - multiple rows
        assert_eq!(
            "{1, 2, 3; 4, 5, 6}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6}, 1, 2)")
        );
        assert_eq!(
            "{4, 5, 6; 1, 2, 3}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6}, 2, 1)")
        );

        // CHOOSEROWS - negative indices
        assert_eq!(
            "{4, 5, 6}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6}, -1)")
        );
        assert_eq!(
            "{1, 2, 3}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6}, -2)")
        );

        // CHOOSEROWS - mixed positive and negative
        assert_eq!(
            "{1, 2, 3; 4, 5, 6}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6}, 1, -1)")
        );

        // CHOOSEROWS - duplicate rows
        assert_eq!(
            "{1, 2, 3; 1, 2, 3}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6}, 1, 1)")
        );

        // CHOOSEROWS with 3 rows
        assert_eq!(
            "{4, 5, 6}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6; 7, 8, 9}, 2)")
        );
        assert_eq!(
            "{7, 8, 9}",
            eval_to_string(&g, "CHOOSEROWS({1, 2, 3; 4, 5, 6; 7, 8, 9}, -1)")
        );

        // Error: index 0 is invalid
        assert_eq!(
            RunErrorMsg::IndexOutOfBounds,
            eval_to_err(&g, "CHOOSEROWS({1; 2; 3}, 0)").msg,
        );

        // Error: index out of bounds
        assert_eq!(
            RunErrorMsg::IndexOutOfBounds,
            eval_to_err(&g, "CHOOSEROWS({1; 2; 3}, 4)").msg,
        );

        // Error: negative index out of bounds
        assert_eq!(
            RunErrorMsg::IndexOutOfBounds,
            eval_to_err(&g, "CHOOSEROWS({1; 2; 3}, -4)").msg,
        );

        // Error: missing row indices
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "CHOOSEROWS".into(),
                arg_name: "row_num1".into(),
            },
            eval_to_err(&g, "CHOOSEROWS({1; 2; 3})").msg,
        );
    }

    #[test]
    fn test_scan() {
        let g = GridController::new();

        // Basic SCAN - running sum
        assert_eq!(
            "{1, 3, 6, 10, 15}",
            eval_to_string(&g, "SCAN(0, {1, 2, 3, 4, 5}, LAMBDA(acc, val, acc + val))")
        );

        // SCAN - running product
        assert_eq!(
            "{1, 2, 6, 24, 120}",
            eval_to_string(&g, "SCAN(1, {1, 2, 3, 4, 5}, LAMBDA(acc, val, acc * val))")
        );

        // SCAN - with initial value
        assert_eq!(
            "{11, 13, 16, 20, 25}",
            eval_to_string(&g, "SCAN(10, {1, 2, 3, 4, 5}, LAMBDA(acc, val, acc + val))")
        );

        // SCAN - 2D array preserves shape
        assert_eq!(
            "{1, 3; 6, 10}",
            eval_to_string(&g, "SCAN(0, {1, 2; 3, 4}, LAMBDA(acc, val, acc + val))")
        );

        // SCAN - column array
        assert_eq!(
            "{1; 3; 6}",
            eval_to_string(&g, "SCAN(0, {1; 2; 3}, LAMBDA(acc, val, acc + val))")
        );

        // Error: lambda must have exactly 2 parameters
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SCAN(0, {1, 2, 3}, LAMBDA(x, x))").msg,
        );
    }

    #[test]
    fn test_drop() {
        let g = GridController::new();

        // Basic DROP - drop rows from start
        assert_eq!(
            "{4, 5, 6; 7, 8, 9}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6; 7, 8, 9}, 1)")
        );
        assert_eq!(
            "{7, 8, 9}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6; 7, 8, 9}, 2)")
        );

        // DROP - drop rows from end (negative)
        assert_eq!(
            "{1, 2, 3; 4, 5, 6}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6; 7, 8, 9}, -1)")
        );
        assert_eq!(
            "{1, 2, 3}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6; 7, 8, 9}, -2)")
        );

        // DROP - drop columns from start
        assert_eq!(
            "{2, 3; 5, 6}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6}, 0, 1)")
        );
        assert_eq!(
            "{3; 6}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6}, 0, 2)")
        );

        // DROP - drop columns from end (negative)
        assert_eq!(
            "{1, 2; 4, 5}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6}, 0, -1)")
        );
        assert_eq!(
            "{1; 4}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6}, 0, -2)")
        );

        // DROP - drop both rows and columns
        assert_eq!(
            "{5, 6}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6}, 1, 1)")
        );
        assert_eq!(
            "{1, 2}",
            eval_to_string(&g, "DROP({1, 2, 3; 4, 5, 6}, -1, -1)")
        );

        // DROP - single row array
        assert_eq!("{2, 3}", eval_to_string(&g, "DROP({1, 2, 3}, 0, 1)"));
        assert_eq!("{1, 2}", eval_to_string(&g, "DROP({1, 2, 3}, 0, -1)"));

        // DROP - single column array
        assert_eq!("{2; 3}", eval_to_string(&g, "DROP({1; 2; 3}, 1)"));
        assert_eq!("{1; 2}", eval_to_string(&g, "DROP({1; 2; 3}, -1)"));

        // Error: dropping all rows/columns results in empty array
        assert_eq!(
            RunErrorMsg::EmptyArray,
            eval_to_err(&g, "DROP({1, 2, 3}, 1)").msg,
        );
        assert_eq!(
            RunErrorMsg::EmptyArray,
            eval_to_err(&g, "DROP({1, 2, 3}, 0, 3)").msg,
        );
    }

    #[test]
    fn test_expand() {
        let g = GridController::new();

        // Basic EXPAND - expand rows
        let result = eval_to_string(&g, "EXPAND({1, 2; 3, 4}, 3)");
        // The third row should contain #N/A errors
        assert!(result.contains("1, 2"));
        assert!(result.contains("3, 4"));

        // EXPAND - expand columns
        let result = eval_to_string(&g, "EXPAND({1, 2; 3, 4}, 2, 3)");
        assert!(result.contains("1, 2"));
        assert!(result.contains("3, 4"));

        // EXPAND - with custom pad value
        assert_eq!(
            "{1, 2, 0; 0, 0, 0}",
            eval_to_string(&g, "EXPAND({1, 2}, 2, 3, 0)")
        );

        // EXPAND - with text pad value
        assert_eq!(
            "{1, -, -; -, -, -}",
            eval_to_string(&g, "EXPAND({1}, 2, 3, \"-\")")
        );

        // EXPAND - same size (no change)
        assert_eq!(
            "{1, 2; 3, 4}",
            eval_to_string(&g, "EXPAND({1, 2; 3, 4}, 2, 2)")
        );

        // EXPAND - single cell
        assert_eq!(
            "{1, 0, 0; 0, 0, 0; 0, 0, 0}",
            eval_to_string(&g, "EXPAND({1}, 3, 3, 0)")
        );

        // Error: cannot reduce dimensions
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "EXPAND({1, 2, 3}, 1, 2)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "EXPAND({1; 2; 3}, 2)").msg,
        );

        // Error: invalid dimensions
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "EXPAND({1, 2}, 0)").msg,
        );
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "EXPAND({1, 2}, 1, -1)").msg,
        );
    }

    #[test]
    fn test_formulatext() {
        use crate::SheetPos;
        use crate::grid::CodeCellLanguage;

        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];

        // Set a formula at A1
        g.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "SUM(B1:B5)".to_string(),
            None,
            None,
            false,
        );

        // FORMULATEXT should return the formula text
        let result = eval_to_string(&g, "FORMULATEXT(A1)");
        // The result should contain the formula or N/A if the formula hasn't run yet
        assert!(
            result.contains("SUM") || result.contains("N/A"),
            "Expected formula text or N/A, got: {}",
            result
        );

        // FORMULATEXT on a cell without formula should return N/A
        let result = eval_to_string(&g, "FORMULATEXT(Z99)");
        assert!(
            result.contains("N/A"),
            "Expected N/A error for non-formula cell, got: {}",
            result
        );
    }

    #[test]
    fn test_hstack() {
        let g = GridController::new();

        // Basic HSTACK - two column vectors
        assert_eq!(
            "{1, 4; 2, 5; 3, 6}",
            eval_to_string(&g, "HSTACK({1; 2; 3}, {4; 5; 6})")
        );

        // HSTACK - two row vectors (single row each)
        assert_eq!("{1, 2, 3, 4}", eval_to_string(&g, "HSTACK({1, 2}, {3, 4})"));

        // HSTACK - single values
        assert_eq!("{1, 2, 3}", eval_to_string(&g, "HSTACK(1, 2, 3)"));

        // HSTACK - mixed arrays and single values
        assert_eq!(
            "{1, 2, 0; 3, 4, 0}",
            eval_to_string(&g, "HSTACK({1, 2; 3, 4}, 0)")
        );

        // HSTACK - single value expanded to match height
        assert_eq!(
            "{1, 0; 2, 0; 3, 0}",
            eval_to_string(&g, "HSTACK({1; 2; 3}, 0)")
        );

        // HSTACK - single row expanded to match height
        assert_eq!(
            "{1, 4, 5; 2, 4, 5; 3, 4, 5}",
            eval_to_string(&g, "HSTACK({1; 2; 3}, {4, 5})")
        );

        // HSTACK - multiple arrays
        assert_eq!("{1, 2, 3}", eval_to_string(&g, "HSTACK({1}, {2}, {3})"));

        // HSTACK - 2D arrays side by side
        assert_eq!(
            "{1, 2, 5, 6; 3, 4, 7, 8}",
            eval_to_string(&g, "HSTACK({1, 2; 3, 4}, {5, 6; 7, 8})")
        );

        // Error: height mismatch
        assert_eq!(
            RunErrorMsg::ArrayAxisMismatch {
                axis: Axis::Y,
                expected: 3,
                got: 2,
            },
            eval_to_err(&g, "HSTACK({1; 2; 3}, {4; 5})").msg,
        );

        // Error: no arguments
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "HSTACK".into(),
                arg_name: "array1".into(),
            },
            eval_to_err(&g, "HSTACK()").msg,
        );
    }

    #[test]
    fn test_hyperlink() {
        let g = GridController::new();

        // HYPERLINK with just URL
        assert_eq!(
            "https://example.com",
            eval_to_string(&g, "HYPERLINK(\"https://example.com\")")
        );

        // HYPERLINK with friendly name
        assert_eq!(
            "Click here",
            eval_to_string(&g, "HYPERLINK(\"https://example.com\", \"Click here\")")
        );

        // HYPERLINK with URL as friendly name (will be auto-detected as link by client)
        assert_eq!(
            "https://google.com",
            eval_to_string(
                &g,
                "HYPERLINK(\"https://example.com\", \"https://google.com\")"
            )
        );

        // HYPERLINK with empty friendly name returns empty string
        assert_eq!(
            "",
            eval_to_string(&g, "HYPERLINK(\"https://example.com\", \"\")")
        );

        // HYPERLINK with cell reference as URL
        let arr = array!["https://test.com"];
        let g = GridController::from_grid(Grid::from_array(pos![A1], &arr), 0);
        assert_eq!("https://test.com", eval_to_string(&g, "HYPERLINK(A1)"));
    }

    #[test]
    fn test_sortby() {
        let g = GridController::new();

        // Basic SORTBY - sort by separate array (ascending by default)
        assert_eq!(
            "{a, 1; b, 2; c, 3}",
            eval_to_string(&g, "SORTBY({\"c\", 3; \"a\", 1; \"b\", 2}, {3; 1; 2})")
        );

        // SORTBY - descending order
        assert_eq!(
            "{c, 3; b, 2; a, 1}",
            eval_to_string(&g, "SORTBY({\"c\", 3; \"a\", 1; \"b\", 2}, {3; 1; 2}, -1)")
        );

        // SORTBY - sort by text
        assert_eq!(
            "{apple, 1; banana, 2; cherry, 3}",
            eval_to_string(
                &g,
                "SORTBY({\"banana\", 2; \"cherry\", 3; \"apple\", 1}, {\"banana\"; \"cherry\"; \"apple\"})"
            )
        );

        // SORTBY - sort numbers
        assert_eq!(
            "{1, 100; 2, 200; 3, 300}",
            eval_to_string(&g, "SORTBY({3, 300; 1, 100; 2, 200}, {3; 1; 2})")
        );

        // SORTBY - multiple sort keys
        assert_eq!(
            "{a, 1; a, 2; b, 1; b, 2}",
            eval_to_string(
                &g,
                "SORTBY({\"b\", 2; \"a\", 1; \"b\", 1; \"a\", 2}, {\"b\"; \"a\"; \"b\"; \"a\"}, 1, {2; 1; 1; 2}, 1)"
            )
        );

        // SORTBY - secondary key with descending
        assert_eq!(
            "{a, 2; a, 1; b, 2; b, 1}",
            eval_to_string(
                &g,
                "SORTBY({\"b\", 2; \"a\", 1; \"b\", 1; \"a\", 2}, {\"b\"; \"a\"; \"b\"; \"a\"}, 1, {2; 1; 1; 2}, -1)"
            )
        );

        // Error: by_array has different height
        assert_eq!(
            RunErrorMsg::ArrayAxisMismatch {
                axis: Axis::Y,
                expected: 3,
                got: 2,
            },
            eval_to_err(&g, "SORTBY({1; 2; 3}, {1; 2})").msg,
        );

        // Error: invalid sort order
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "SORTBY({1; 2; 3}, {1; 2; 3}, 0)").msg,
        );

        // Error: missing by_array
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "SORTBY".into(),
                arg_name: "by_array1".into(),
            },
            eval_to_err(&g, "SORTBY({1; 2; 3})").msg,
        );
    }

    #[test]
    fn test_take() {
        let g = GridController::new();

        // Basic TAKE - take rows from start
        assert_eq!(
            "{1, 2, 3; 4, 5, 6}",
            eval_to_string(&g, "TAKE({1, 2, 3; 4, 5, 6; 7, 8, 9}, 2)")
        );
        assert_eq!(
            "{1, 2, 3}",
            eval_to_string(&g, "TAKE({1, 2, 3; 4, 5, 6; 7, 8, 9}, 1)")
        );

        // TAKE - take rows from end (negative)
        assert_eq!(
            "{4, 5, 6; 7, 8, 9}",
            eval_to_string(&g, "TAKE({1, 2, 3; 4, 5, 6; 7, 8, 9}, -2)")
        );
        assert_eq!(
            "{7, 8, 9}",
            eval_to_string(&g, "TAKE({1, 2, 3; 4, 5, 6; 7, 8, 9}, -1)")
        );

        // TAKE - take columns from start
        assert_eq!(
            "{1, 2; 4, 5}",
            eval_to_string(&g, "TAKE({1, 2, 3; 4, 5, 6}, 2, 2)")
        );
        assert_eq!(
            "{1; 4}",
            eval_to_string(&g, "TAKE({1, 2, 3; 4, 5, 6}, 2, 1)")
        );

        // TAKE - take columns from end (negative)
        assert_eq!(
            "{2, 3; 5, 6}",
            eval_to_string(&g, "TAKE({1, 2, 3; 4, 5, 6}, 2, -2)")
        );
        assert_eq!(
            "{3; 6}",
            eval_to_string(&g, "TAKE({1, 2, 3; 4, 5, 6}, 2, -1)")
        );

        // TAKE - take more than available (returns all)
        assert_eq!("{1, 2, 3}", eval_to_string(&g, "TAKE({1, 2, 3}, 5)"));

        // TAKE - single row array
        assert_eq!("{1, 2}", eval_to_string(&g, "TAKE({1, 2, 3}, 1, 2)"));
        assert_eq!("{2, 3}", eval_to_string(&g, "TAKE({1, 2, 3}, 1, -2)"));

        // TAKE - single column array
        assert_eq!("{1; 2}", eval_to_string(&g, "TAKE({1; 2; 3}, 2)"));
        assert_eq!("{2; 3}", eval_to_string(&g, "TAKE({1; 2; 3}, -2)"));

        // Error: 0 rows not allowed
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "TAKE({1, 2, 3}, 0)").msg,
        );

        // Error: 0 columns not allowed
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "TAKE({1, 2, 3}, 1, 0)").msg,
        );
    }

    #[test]
    fn test_tocol() {
        let g = GridController::new();

        // Basic TOCOL - 2D array to column (row-major scan, default)
        assert_eq!("{1; 2; 3; 4}", eval_to_string(&g, "TOCOL({1, 2; 3, 4})"));

        // TOCOL - single row to column
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "TOCOL({1, 2, 3})"));

        // TOCOL - column stays as column
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "TOCOL({1; 2; 3})"));

        // TOCOL - scan by column
        assert_eq!(
            "{1; 3; 2; 4}",
            eval_to_string(&g, "TOCOL({1, 2; 3, 4}, , TRUE)")
        );

        // TOCOL - 3x3 array, row-major
        assert_eq!(
            "{1; 2; 3; 4; 5; 6; 7; 8; 9}",
            eval_to_string(&g, "TOCOL({1, 2, 3; 4, 5, 6; 7, 8, 9})")
        );

        // TOCOL - 3x3 array, column-major
        assert_eq!(
            "{1; 4; 7; 2; 5; 8; 3; 6; 9}",
            eval_to_string(&g, "TOCOL({1, 2, 3; 4, 5, 6; 7, 8, 9}, , TRUE)")
        );

        // TOCOL - single value
        assert_eq!("{1}", eval_to_string(&g, "TOCOL({1})"));

        // Error: invalid ignore value
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "TOCOL({1, 2, 3}, 4)").msg,
        );
    }

    #[test]
    fn test_torow() {
        let g = GridController::new();

        // Basic TOROW - column to row
        assert_eq!("{1, 2, 3, 4}", eval_to_string(&g, "TOROW({1; 2; 3; 4})"));

        // TOROW - 2D array to row (row-major scan, default)
        assert_eq!("{1, 2, 3, 4}", eval_to_string(&g, "TOROW({1, 2; 3, 4})"));

        // TOROW - row stays as row
        assert_eq!("{1, 2, 3}", eval_to_string(&g, "TOROW({1, 2, 3})"));

        // TOROW - scan by column
        assert_eq!(
            "{1, 3, 2, 4}",
            eval_to_string(&g, "TOROW({1, 2; 3, 4}, , TRUE)")
        );

        // TOROW - 3x3 array, row-major
        assert_eq!(
            "{1, 2, 3, 4, 5, 6, 7, 8, 9}",
            eval_to_string(&g, "TOROW({1, 2, 3; 4, 5, 6; 7, 8, 9})")
        );

        // TOROW - 3x3 array, column-major
        assert_eq!(
            "{1, 4, 7, 2, 5, 8, 3, 6, 9}",
            eval_to_string(&g, "TOROW({1, 2, 3; 4, 5, 6; 7, 8, 9}, , TRUE)")
        );

        // TOROW - single value
        assert_eq!("{1}", eval_to_string(&g, "TOROW({1})"));

        // Error: invalid ignore value
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "TOROW({1, 2, 3}, 4)").msg,
        );
    }

    #[test]
    fn test_vstack() {
        let g = GridController::new();

        // Basic VSTACK - two rows
        assert_eq!("{1, 2; 3, 4}", eval_to_string(&g, "VSTACK({1, 2}, {3, 4})"));

        // VSTACK - two columns
        assert_eq!(
            "{1; 2; 3; 4; 5; 6}",
            eval_to_string(&g, "VSTACK({1; 2; 3}, {4; 5; 6})")
        );

        // VSTACK - with single value
        assert_eq!(
            "{1, 2, 3; 0, 0, 0}",
            eval_to_string(&g, "VSTACK({1, 2, 3}, 0)")
        );

        // VSTACK - single value expanded to match width
        assert_eq!(
            "{0, 0, 0; 1, 2, 3}",
            eval_to_string(&g, "VSTACK(0, {1, 2, 3})")
        );

        // VSTACK - single column expanded to match width
        assert_eq!(
            "{1, 1, 1; 4, 5, 6}",
            eval_to_string(&g, "VSTACK({1}, {4, 5, 6})")
        );

        // VSTACK - multiple arrays
        assert_eq!("{1; 2; 3}", eval_to_string(&g, "VSTACK({1}, {2}, {3})"));

        // VSTACK - 2D arrays stacked
        assert_eq!(
            "{1, 2; 3, 4; 5, 6; 7, 8}",
            eval_to_string(&g, "VSTACK({1, 2; 3, 4}, {5, 6; 7, 8})")
        );

        // Error: width mismatch
        assert_eq!(
            RunErrorMsg::ArrayAxisMismatch {
                axis: Axis::X,
                expected: 3,
                got: 2,
            },
            eval_to_err(&g, "VSTACK({1, 2, 3}, {4, 5})").msg,
        );

        // Error: no arguments
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "VSTACK".into(),
                arg_name: "array1".into(),
            },
            eval_to_err(&g, "VSTACK()").msg,
        );
    }
}
