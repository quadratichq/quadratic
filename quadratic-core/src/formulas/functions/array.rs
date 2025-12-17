use std::collections::HashMap;

use smallvec::SmallVec;

use super::*;
use crate::{ArraySize, CellValueHash};

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
    ]
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
}
