use std::collections::HashMap;

use smallvec::SmallVec;

use crate::CellValueHash;

use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Array functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
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
                        if *include.get(0).unwrap_or(&false) {
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
                        match Array::from_slices(axis, new_slices) {
                            Some(a) => Value::from(a),
                            None => empty_result?,
                        }
                    }
                }
            }
        ),
        formula_fn!(
            /// TODO: documentation
            #[examples("SORT()")]
            fn SORT(
                array: Array,
                sort_index: (Option<f64>),
                sort_order: (Option<f64>),
                by_column: (Option<bool>),
            ) {
                array // TODO
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
                Array::from_slices(axis, new_slices)
                    .ok_or(RunErrorMsg::EmptyArray.with_span(span))?
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
#[serial_test::parallel]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_filter() {
        let all_shapes = array![
            "tetrahedron", 3, 3;
            "cube", 4, 3; // favorite
            "octahedron", 3, 4; // favorite
            "dodecahedron", 5, 3;
            "icosahedron", 3, 5; // favorite
        ];
        let g = Grid::from_array(pos![A1], &all_shapes);

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
        let g = Grid::from_array(pos![A1], &all_shapes.transpose());
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
    fn test_formula_sort() {}

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

        let g = Grid::from_array(pos![A1], &source_data);

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

        let g = Grid::from_array(pos![A1], &source_data.transpose());
        let expected_unique = expected_unique.transpose();
        let expected_exactly_once = expected_exactly_once.transpose();

        assert_eq!(
            pos![M2], // If this changes, update all the formulas too
            crate::Pos {
                x: source_data.height() as i64 - 1, // minus 1 because range is inclusive and we start at column 0
                y: source_data.width() as i64, // minus 1 because range is inclusive, plus 1 because we start at row 1
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
}
