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
    ]
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
}
