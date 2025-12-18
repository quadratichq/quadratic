//! Search/lookup functions: VLOOKUP, HLOOKUP, XLOOKUP, LOOKUP, MATCH, XMATCH

use itertools::Itertools;
use smallvec::smallvec;

use super::{LookupMatchMode, LookupSearchMode, lookup, *};

pub(super) fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Searches for a value in the first vertical column of a range and
            /// return the corresponding cell in another vertical column, or an
            /// error if no match is found.
            ///
            /// If `is_sorted` is `TRUE`, this function uses a [binary search
            /// algorithm](https://en.wikipedia.org/wiki/Binary_search_algorithm),
            /// so the first column of `search_range` must be sorted, with
            /// smaller values at the top and larger values at the bottom;
            /// otherwise the result of this function will be meaningless. If
            /// `is_sorted` is omitted, it is assumed to be `false`.
            ///
            /// If any of `search_key`, `output_col`, or `is_sorted` is an
            /// array, then they must be compatible sizes and a lookup will be
            /// performed for each corresponding set of elements.
            #[examples("VLOOKUP(17, A1:C10, 3)", "VLOOKUP(17, A1:C10, 2, FALSE)")]
            #[zip_map]
            fn VLOOKUP(
                span: Span,
                [search_key]: CellValue,
                search_range: Array,
                [output_col]: u32,
                [is_sorted]: (Option<bool>),
            ) {
                let needle = search_key;
                let haystack = &(0..search_range.height())
                    .filter_map(|y| search_range.get(0, y).ok())
                    .collect_vec();
                let match_mode = LookupMatchMode::Exact;
                let search_mode = LookupSearchMode::from_is_sorted(is_sorted);

                let x = output_col
                    .checked_sub(1)
                    .ok_or(RunErrorMsg::IndexOutOfBounds)?;
                let y = lookup(needle, haystack, match_mode, search_mode)?
                    .ok_or_else(|| RunErrorMsg::NoMatch.with_span(span))?;

                search_range.get(x, y as u32)?.clone()
            }
        ),
        formula_fn!(
            /// Searches for a value in the first horizontal row of a range and
            /// return the corresponding cell in another horizontal row, or an
            /// error if no match is found.
            ///
            /// If `is_sorted` is `TRUE`, this function uses a [binary search
            /// algorithm](https://en.wikipedia.org/wiki/Binary_search_algorithm),
            /// so the first row of `search_range` must be sorted, with smaller
            /// values at the left and larger values at the right; otherwise the
            /// result of this function will be meaningless. If `is_sorted` is
            /// omitted, it is assumed to be `false`.
            ///
            /// If any of `search_key`, `output_col`, or `is_sorted` is an
            /// array, then they must be compatible sizes and a lookup will be
            /// performed for each corresponding set of elements.
            #[examples("HLOOKUP(17, A1:Z3, 3)", "HLOOKUP(17, A1:Z3, 2, FALSE)")]
            #[zip_map]
            fn HLOOKUP(
                span: Span,
                [search_key]: CellValue,
                search_range: Array,
                [output_row]: u32,
                [is_sorted]: (Option<bool>),
            ) {
                let needle = search_key;
                let haystack = search_range
                    .rows()
                    .next()
                    .ok_or_else(|| internal_error_value!("missing first row"))?;
                let match_mode = LookupMatchMode::Exact;
                let search_mode = LookupSearchMode::from_is_sorted(is_sorted);

                let x = lookup(needle, haystack, match_mode, search_mode)?
                    .ok_or_else(|| RunErrorMsg::NoMatch.with_span(span))?;
                let y = output_row
                    .checked_sub(1)
                    .ok_or(RunErrorMsg::IndexOutOfBounds)?;

                search_range.get(x as u32, y)?.clone()
            }
        ),
        formula_fn!(
            /// Searches for a value in a linear range and returns a row or
            /// column from another range.
            ///
            /// `search_range` must be either a single row or a single column.
            ///
            /// # Match modes
            ///
            /// There are four match modes:
            ///
            /// - 0 = exact match (default)
            /// - -1 = next smaller
            /// - 1 = next larger
            /// - 2 = wildcard
            ///
            #[doc = see_docs_for_more_about_wildcards!()]
            ///
            /// # Search modes
            ///
            /// There are four search modes:
            ///
            /// - 1 = linear search (default)
            /// - -1 = reverse linear search
            /// - 2 = [binary
            ///        search](https://en.wikipedia.org/wiki/Binary_search_algorithm)
            /// - -2 = reverse binary search
            ///
            /// Linear search finds the first matching value, while reverse
            /// linear search finds the last matching value.
            ///
            /// Binary search may be faster than linear search, but binary
            /// search requires that values are sorted, with smaller values at
            /// the top or left and larger values at the bottom or right.
            /// Reverse binary search requires that values are sorted in the
            /// opposite direction. If `search_range` is not sorted, then the
            /// result of this function will be meaningless.
            ///
            /// Binary search is not compatible with the wildcard match mode.
            ///
            /// # Result
            ///
            /// If `search_range` is a row, then it must have the same width as
            /// `output_range` so that each value in `search_range` corresponds
            /// to a column in `output_range`. In this case, the **search axis**
            /// is vertical.
            ///
            /// If `search_range` is a column, then it must have the same height
            /// as `output_range` so that each value in `search_range`
            /// corresponds to a row in `output_range`. In this case, the
            /// **search axis** is horizontal.
            ///
            /// If a match is not found, then `fallback` is returned instead. If
            /// there is no match and `fallback` is omitted, then returns an
            /// error.
            ///
            /// If any of `search_key`, `fallback`, `match_mode`, or
            /// `search_mode` is an array, then they must be compatible sizes
            /// and a lookup will be performed for each corresponding set of
            /// elements. These arrays must also have compatible size with the
            /// non-search axis of `output_range`.
            #[examples(
                "XLOOKUP(\"zebra\", A1:Z1, A4:Z6)",
                "XLOOKUP({\"zebra\"; \"aardvark\"}, A1:Z1, A4:Z6)",
                "XLOOKUP(50, C4:C834, B4:C834, {-1, 0, \"not found\"}, -1, 2)"
            )]
            fn XLOOKUP(
                span: Span,
                search_key: (Spanned<Array>),
                search_range: (Spanned<Array>),
                output_range: (Spanned<Array>),
                fallback: (Option<Spanned<Array>>),
                match_mode: (Option<Spanned<i64>>),
                search_mode: (Option<Spanned<i64>>),
            ) {
                let fallback = fallback.unwrap_or(Spanned {
                    span,
                    inner: Array::from(CellValue::Error(Box::new(
                        RunErrorMsg::NoMatch.with_span(span),
                    ))),
                });
                let search_mode_span = search_mode.map_or(span, |arg| arg.span);
                let match_mode = LookupMatchMode::try_from(match_mode)?;
                let search_mode = LookupSearchMode::try_from(search_mode)?;

                // Check for invalid combination
                if match_mode == LookupMatchMode::Wildcard {
                    match search_mode {
                        LookupSearchMode::LinearForward | LookupSearchMode::LinearReverse => (), //ok
                        LookupSearchMode::BinaryAscending | LookupSearchMode::BinaryDescending => {
                            // not ok -- can't do binary search with wildcard
                            return Err(RunErrorMsg::InvalidArgument.with_span(search_mode_span));
                        }
                    }
                }

                // Give more concise names so it's easier to keep track of them
                // while reading this code.
                let needle = search_key;
                let haystack = search_range;
                let returns = output_range;

                // Infer which axis to search along.
                let search_axis = None
                    .or_else(|| haystack.array_linear_axis().transpose())
                    .or_else(|| returns.array_linear_axis().transpose())
                    .transpose()? // Error if the array is not linear.
                    .unwrap_or(Axis::Y);
                let non_search_axis = search_axis.other_axis();

                // Without loss of generality, assume `search_axis == Axis::X`
                // for the sake of this comment. Let:
                //
                // - N = `search_len`
                // - Q, R = any positive integers
                //
                // _Q_ and _R_ may be substituted with 1 in any array and it
                // will be expanded to fit. Then we expect the following:
                //
                // - `haystack` is Nx1
                // - The output of the function is QxR
                // - `needle` is QxR
                // - `returns` is NxR
                // - `fallback` is QxR

                // Find the values for N, Q, and R, and error if there's an
                // array mismatch.
                let n = Array::common_len(search_axis, [&haystack, &returns].map(|v| v.as_ref()))?;
                returns.check_array_size_on(search_axis, n.get())?;
                let q = Array::common_len(search_axis, [&needle, &fallback].map(|v| v.as_ref()))?;
                let r = Array::common_len(
                    non_search_axis,
                    [&needle, &returns, &fallback].map(|v| v.as_ref()),
                )?;

                // Perform the lookup for each needle.
                let haystack_values = haystack.inner.cell_values_slice().iter().collect_vec();
                let lookup_indices = (needle.inner.cell_values_slice().iter())
                    .map(|needle_value| {
                        lookup(needle_value, &haystack_values, match_mode, search_mode)
                    })
                    .collect::<CodeResult<Vec<Option<usize>>>>()?;

                // Construct the final output array.
                let needle_size = needle.inner.size();
                let (result_w, result_h) = match search_axis {
                    Axis::X => (q, r),
                    Axis::Y => (r, q),
                };
                let mut final_output_array = smallvec![];
                let result_size = ArraySize {
                    w: result_w,
                    h: result_h,
                };
                for (x, y) in result_size.iter() {
                    let needle_index = needle_size.flatten_index(x, y)?;
                    match lookup_indices[needle_index] {
                        Some(i) => final_output_array.push({
                            let x = if search_axis == Axis::X { i as u32 } else { x };
                            let y = if search_axis == Axis::Y { i as u32 } else { y };
                            returns.inner.get(x, y)?.clone()
                        }),
                        None => final_output_array.push(fallback.inner.get(x, y)?.clone()),
                    }
                }
                Array::new_row_major(result_size, final_output_array)?
            }
        ),
        formula_fn!(
            /// Searches for a value in a range and returns the index of the
            /// first match, starting from 1.
            ///
            /// If `match_mode` is `1` (the default), then the index of the
            /// _greatest value less than_ `search_key` will be returned. In
            /// this mode, `search_range` must be sorted in ascending order,
            /// with smaller values at the top or left and larger values at the
            /// bottom or right; otherwise the result of this function will be
            /// meaningless.
            ///
            /// If `match_mode` is `-1`, then the index of the _smallest value
            /// greater than_ `search_key` will be returned. In this mode,
            /// `search_range` must be sorted in ascending order, with larger
            /// values at the top or left and smaller values at the bottom or
            /// right; otherwise the result of this function will be
            /// meaningless.
            ///
            /// If `match_mode` is `0`, then the index of the first value
            /// _equal_ to `search_key` will be returned. In this mode,
            /// `search_range` may be in any order. `search_key` may also be a
            /// wildcard.
            ///
            #[doc = see_docs_for_more_about_wildcards!()]
            #[examples(
                "MATCH(12, {10, 20, 30})",
                "MATCH(19, {10, 20, 30}, -1)",
                "MATCH(\"A\", {\"a\"; \"b\"; \"c\"}, 0)"
            )]
            #[zip_map]
            fn MATCH(
                [search_key]: CellValue,
                search_range: (Spanned<Array>),
                match_mode: (Option<f64>),
            ) {
                let match_mode = match_mode.unwrap_or(1.0);
                let (match_mode, search_mode) = if match_mode > 0.0 {
                    (
                        LookupMatchMode::NextSmaller,
                        LookupSearchMode::BinaryAscending,
                    )
                } else if match_mode < 0.0 {
                    (
                        LookupMatchMode::NextLarger,
                        LookupSearchMode::BinaryDescending,
                    )
                } else {
                    (LookupMatchMode::Wildcard, LookupSearchMode::LinearForward)
                };
                let needle = search_key;
                let haystack = search_range.try_as_linear_array()?;
                let index = lookup(needle, haystack, match_mode, search_mode)?
                    .ok_or(RunErrorMsg::NoMatch)?;
                index as i64 + 1 // 1-indexed
            }
        ),
        formula_fn!(
            /// Searches for a value in a one-row or one-column range and returns
            /// a corresponding value from another one-row or one-column range.
            ///
            /// This is the vector form of LOOKUP. If `result_range` is omitted,
            /// `lookup_range` is used for both searching and returning values.
            ///
            /// The values in `lookup_range` must be sorted in ascending order;
            /// otherwise the result may be incorrect. LOOKUP finds the largest
            /// value less than or equal to `lookup_value`.
            ///
            /// If no value is found (all values are greater than `lookup_value`),
            /// returns an error.
            #[examples(
                "LOOKUP(5, {1, 2, 3, 4, 5})",
                "LOOKUP(\"c\", {\"a\", \"b\", \"c\"}, {1, 2, 3})",
                "LOOKUP(50, A1:A10, B1:B10)"
            )]
            fn LOOKUP(
                span: Span,
                lookup_value: CellValue,
                lookup_range: (Spanned<Array>),
                result_range: (Option<Spanned<Array>>),
            ) {
                // Determine if lookup_range is a row or column vector
                let lookup_axis = lookup_range.array_linear_axis()?;
                let lookup_vec = lookup_range.try_as_linear_array()?;

                // Use lookup_range as result_range if not provided
                let result_range = result_range.unwrap_or_else(|| lookup_range.clone());
                let _result_axis = result_range.array_linear_axis()?;
                let result_vec = result_range.try_as_linear_array()?;

                // For vector form, both must be linear and same length
                if lookup_vec.len() != result_vec.len() {
                    return Err(RunErrorMsg::ArrayAxisMismatch {
                        axis: lookup_axis.unwrap_or(Axis::Y),
                        expected: lookup_vec.len() as u32,
                        got: result_vec.len() as u32,
                    }
                    .with_span(span));
                }

                // Use binary search with "next smaller" mode since LOOKUP expects sorted data
                let match_mode = LookupMatchMode::NextSmaller;
                let search_mode = LookupSearchMode::BinaryAscending;

                let index = lookup(&lookup_value, lookup_vec, match_mode, search_mode)?
                    .ok_or_else(|| RunErrorMsg::NoMatch.with_span(span))?;

                // Both are linear - just get the element at the found index
                result_vec
                    .get(index)
                    .cloned()
                    .ok_or_else(|| RunErrorMsg::IndexOutOfBounds.with_span(span))?
            }
        ),
        formula_fn!(
            /// Searches for a value in a range and returns the index of the
            /// first match, starting from 1.
            ///
            /// This is an enhanced version of MATCH with more flexible matching
            /// and search options.
            ///
            /// - `search_key`: The value to search for.
            /// - `search_range`: A one-row or one-column range to search.
            /// - `match_mode`: Optional. How to match:
            ///   - `0` (default): Exact match
            ///   - `-1`: Exact match or next smaller
            ///   - `1`: Exact match or next larger
            ///   - `2`: Wildcard match (*, ?, ~)
            /// - `search_mode`: Optional. How to search:
            ///   - `1` (default): Search first to last
            ///   - `-1`: Search last to first
            ///   - `2`: Binary search ascending (range must be sorted ascending)
            ///   - `-2`: Binary search descending (range must be sorted descending)
            ///
            #[doc = see_docs_for_more_about_wildcards!()]
            #[examples(
                "XMATCH(\"b\", {\"a\", \"b\", \"c\"}) = 2",
                "XMATCH(5, {1, 3, 5, 7, 9}, 0) = 3",
                "XMATCH(4, {1, 3, 5, 7, 9}, 1) = 3",
                "XMATCH(4, {1, 3, 5, 7, 9}, -1) = 2"
            )]
            #[zip_map]
            fn XMATCH(
                span: Span,
                [search_key]: CellValue,
                search_range: (Spanned<Array>),
                match_mode: (Option<i64>),
                search_mode: (Option<i64>),
            ) {
                let match_mode = match match_mode.unwrap_or(0) {
                    0 => LookupMatchMode::Exact,
                    -1 => LookupMatchMode::NextSmaller,
                    1 => LookupMatchMode::NextLarger,
                    2 => LookupMatchMode::Wildcard,
                    _ => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                };
                let search_mode = match search_mode.unwrap_or(1) {
                    1 => LookupSearchMode::LinearForward,
                    -1 => LookupSearchMode::LinearReverse,
                    2 => LookupSearchMode::BinaryAscending,
                    -2 => LookupSearchMode::BinaryDescending,
                    _ => return Err(RunErrorMsg::InvalidArgument.with_span(span)),
                };

                // Check for invalid combination
                if match_mode == LookupMatchMode::Wildcard {
                    match search_mode {
                        LookupSearchMode::LinearForward | LookupSearchMode::LinearReverse => (), //ok
                        LookupSearchMode::BinaryAscending | LookupSearchMode::BinaryDescending => {
                            // not ok -- can't do binary search with wildcard
                            return Err(RunErrorMsg::InvalidArgument.with_span(span));
                        }
                    }
                }

                let needle = search_key;
                let haystack = search_range.try_as_linear_array()?;
                let index = lookup(&needle, haystack, match_mode, search_mode)?
                    .ok_or(RunErrorMsg::NoMatch)?;
                index as i64 + 1 // 1-indexed
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use std::borrow::Cow;

    use lazy_static::lazy_static;
    use smallvec::smallvec;

    use crate::{Axis, Pos, controller::GridController, formulas::tests::*};

    lazy_static! {
        static ref NUMBERS_LOOKUP_ARRAY: Array = array![
            1, "one", "wan";
            2, "two", "tu";
            50, "fifty", "mute";
            100, "hundred", "ale";
        ];
        static ref STRINGS_LOOKUP_ARRAY: Array = array![
            "apPle", 1, "kili loje";
            "BAnAnA", 2, "kili jelo";
            "bread", 3, "pan";
            "EGG", 4, "sike";
        ];
        static ref MIXED_LOOKUP_ARRAY: Array = array![
            2, "two", "tu";
            "bread", 3, "pan";
            50, "fifty", "mute";
            100, "hundred", "ale";
            "apPle", 1, "kili loje";
            "BAnAnA", 2, "kili jelo";
            "EGG", 4, "sike";
            1, "one", "wan";

        ];
        static ref VALUES_THAT_SHOULD_NEVER_MATCH: Vec<CellValue> =
            vec![(-987.0).into(), "this shouldn't match anything".into()];
    }

    /// Test VLOOKUP error conditions.
    #[test]
    fn test_vlookup_errors() {
        // Test using numbers ...
        let array = &*NUMBERS_LOOKUP_ARRAY;
        let g = GridController::from_grid(Grid::from_array(pos![A1], array), 0);

        // Test no match (value missing)
        for col in 1..=3 {
            for is_sorted in ["", ", FALSE", ", TRUE"] {
                for search_key in [-5, 11, 999] {
                    let formula = format!("VLOOKUP({search_key}, A1:C4, {col}{is_sorted})");
                    eval_to_err(&g, &formula);
                }
            }
        }

        // Test no match due to wrong type
        eval_to_err(&g, "VLOOKUP('word', A1:C4, 1)");

        // Invalid argument: blank first argument (no match)
        eval_to_err(&g, "VLOOKUP(, A1:C4, 1)");
        // Invalid argument: blank range argument
        eval_to_err(&g, "VLOOKUP(-99,, 1)");
        // Invalid argument: bad column number
        eval_to_err(&g, "VLOOKUP(-99, A1:C4, 'word')");
        eval_to_err(&g, "VLOOKUP(-99, A1:C4, 0)");
        eval_to_err(&g, "VLOOKUP(-99, A1:C4, 3)");

        // Test using strings ...
        let array = &*STRINGS_LOOKUP_ARRAY;
        let g = GridController::from_grid(Grid::from_array(pos![A1], array), 0);

        // Test no match
        for word in ["aardvark", "crackers", "zebra"] {
            for is_sorted in ["", ", FALSE", ", TRUE"] {
                eval_to_err(&g, &format!("VLOOKUP('{word}', A1:C4, 1 {is_sorted})"));
            }
        }

        // Test no match due to wrong type
        eval_to_err(&g, "VLOOKUP(10, A1:C4, 1)");
        eval_to_err(&g, "VLOOKUP(10, A1:C4, 1, FALSE)");
        eval_to_err(&g, "VLOOKUP(10, A1:C4, 1, TRUE)");
    }

    /// Test VLOOKUP.
    #[test]
    fn test_vlookup() {
        // Test exact match (unsorted)
        let array = &*MIXED_LOOKUP_ARRAY;
        let g = GridController::from_grid(Grid::from_array(pos![A1], array), 0);
        for is_sorted in ["", ", FALSE"] {
            for row in array.clone().rows() {
                let s = row[0].repr();
                // should be case-insensitive
                for needle in [&s, &s.to_ascii_lowercase(), &s.to_ascii_uppercase()] {
                    for (i, elem) in row.iter().enumerate() {
                        let col = i + 1;
                        let formula = format!("VLOOKUP({needle}, A1:C8, {col} {is_sorted})");
                        assert_eq!(elem.to_string(), eval_to_string(&g, &formula));
                        let formula = format!("VLOOKUP({needle}, A:C, {col} {is_sorted})"); // column selection
                        assert_eq!(elem.to_string(), eval_to_string(&g, &formula));
                    }
                }
            }
        }

        // Test exact match (sorted)
        let array = &*STRINGS_LOOKUP_ARRAY;
        let g = GridController::from_grid(Grid::from_array(pos![A1], array), 0);
        for row in array.clone().rows() {
            let s = row[0].repr();
            // should be case-insensitive
            for needle in [&s, &s.to_ascii_lowercase(), &s.to_ascii_uppercase()] {
                for (i, elem) in row.iter().enumerate() {
                    let col = i + 1;
                    let formula = format!("VLOOKUP({needle}, A1:C4, {col}, TRUE)");
                    assert_eq!(elem.to_string(), eval_to_string(&g, &formula));
                    let formula = format!("VLOOKUP({needle}, A:C, {col}, TRUE)"); // column selection
                    assert_eq!(elem.to_string(), eval_to_string(&g, &formula));
                }
            }
        }
    }

    /// Test that VLOOKUP ignores error values.
    #[test]
    fn test_vlookup_ignore_errors() {
        let g = GridController::from_grid(
            Grid::from_array(pos![A1], &array!["a", 10; 1.0 / 0.0, 20; "b", 30]),
            0,
        );
        assert_eq!("10", eval_to_string(&g, "VLOOKUP(\"a\", A1:B3, 2)"));
        assert_eq!("30", eval_to_string(&g, "VLOOKUP(\"b\", A1:B3, 2)"));
    }

    /// Test HLOOKUP error conditions.
    #[test]
    fn test_hlookup_errors() {
        // Test using numbers ...
        let transposed_array = &*NUMBERS_LOOKUP_ARRAY;
        let array = transposed_array.transpose();
        let g = GridController::from_grid(Grid::from_array(pos![A1], &array), 0);

        // Test no match (value missing)
        for row in 1..=3 {
            for is_sorted in ["", ", FALSE", ", TRUE"] {
                for search_key in [-5, 11, 999] {
                    let formula = format!("HLOOKUP({search_key}, A1:D3, {row}{is_sorted})");
                    eval_to_err(&g, &formula);
                }
            }
        }

        // Test no match due to wrong type
        eval_to_err(&g, "HLOOKUP('word', A1:D3, 1)");

        // Invalid argument: blank first argument (no match)
        eval_to_err(&g, "HLOOKUP(, A1:D3, 1)");
        // Invalid argument: blank range argument
        eval_to_err(&g, "HLOOKUP(-99,, 1)");
        // Invalid argument: bad column number
        eval_to_err(&g, "HLOOKUP(-99, A1:D3, 'word')");
        eval_to_err(&g, "HLOOKUP(-99, A1:D3, 0)");
        eval_to_err(&g, "HLOOKUP(-99, A1:D3, 3)");

        // Test using strings ...
        let transposed_array = &*STRINGS_LOOKUP_ARRAY;
        let array = transposed_array.transpose();
        let g = GridController::from_grid(Grid::from_array(pos![A1], &array), 0);

        // Test no match
        for word in ["aardvark", "crackers", "zebra"] {
            for is_sorted in ["", ", FALSE", ", TRUE"] {
                eval_to_err(&g, &format!("HLOOKUP('{word}', A1:D3, 1 {is_sorted})"));
            }
        }

        // Test no match due to wrong type
        eval_to_err(&g, "HLOOKUP(10, A1:D3, 1)");
        eval_to_err(&g, "HLOOKUP(10, A1:D3, 1, FALSE)");
        eval_to_err(&g, "HLOOKUP(10, A1:D3, 1, TRUE)");
    }

    /// Test HLOOKUP.
    #[test]
    fn test_hlookup() {
        // Test exact match (unsorted)
        let transposed_array = &*MIXED_LOOKUP_ARRAY;
        let array = transposed_array.transpose();
        let g = GridController::from_grid(Grid::from_array(pos![A1], &array), 0);
        for is_sorted in ["", ", FALSE"] {
            for col in transposed_array.clone().rows() {
                let s = col[0].repr();
                // should be case-insensitive
                for needle in [&s, &s.to_ascii_lowercase(), &s.to_ascii_uppercase()] {
                    for (i, elem) in col.iter().enumerate() {
                        let col = i + 1;
                        let formula = format!("HLOOKUP({needle}, A1:H3, {col} {is_sorted})");
                        assert_eq!(elem.to_string(), eval_to_string(&g, &formula));
                    }
                }
            }
        }

        // Test exact match (sorted)
        let transposed_array = &*STRINGS_LOOKUP_ARRAY;
        let array = transposed_array.transpose();
        let g = GridController::from_grid(Grid::from_array(pos![A1], &array), 0);
        for col in transposed_array.clone().rows() {
            let s = col[0].repr();
            // should be case-insensitive
            for needle in [&s, &s.to_ascii_lowercase(), &s.to_ascii_uppercase()] {
                for (i, elem) in col.iter().enumerate() {
                    let col = i + 1;
                    let formula = format!("HLOOKUP({needle}, A1:D3, {col}, TRUE)");
                    assert_eq!(elem.to_string(), eval_to_string(&g, &formula));
                }
            }
        }
    }

    /// Test XLOOKUP input validation
    #[test]
    fn test_xlookup_validation() {
        let array = &*NUMBERS_LOOKUP_ARRAY;
        let g = GridController::from_grid(Grid::from_array(pos![A1], array), 0);

        const EXPECTED_NUMBER_ERR: RunErrorMsg = RunErrorMsg::Expected {
            expected: Cow::Borrowed("number"),
            got: Some(Cow::Borrowed("text")),
        };

        // Good value for `match_mode`
        eval_to_string(&g, "XLOOKUP(50, A1:A4, B1:B4, 1)");
        // Bad values for `match_mode`
        let e = &RunErrorMsg::InvalidArgument;
        expect_err(e, &g, "XLOOKUP(50, A1:A4, B1:B4,, -2)");
        let e = &EXPECTED_NUMBER_ERR;
        expect_err(e, &g, "XLOOKUP(50, A1:A4, B1:B4,, 'word')");

        // Good value for `search_mode`
        eval_to_string(&g, "XLOOKUP(50, A1:A4, B1:B4,,, 1)");
        // Bad values for `search_mode`
        let e = &RunErrorMsg::InvalidArgument;
        expect_err(e, &g, "XLOOKUP(50, A1:A4, B1:B4,,, 0)");
        expect_err(e, &g, "XLOOKUP(50, A1:A4, B1:B4,,, -3)");
        let e = &EXPECTED_NUMBER_ERR;
        expect_err(e, &g, "XLOOKUP(50, A1:A4, B1:B4,,, 'word')");

        // 1xN and Nx1 are ok
        eval_to_string(&g, "XLOOKUP(50, A1:A4, B1:B4)");
        eval_to_string(&g, "XLOOKUP(50, A3:C3, A2:C2)");

        // 1x1 is ok
        eval_to_string(&g, "XLOOKUP(50, A3:A3, B3:B3)");
        eval_to_string(&g, "XLOOKUP(50, A3, B3:B3)");
        eval_to_string(&g, "XLOOKUP(50, A3:A3, B3)");
        eval_to_string(&g, "XLOOKUP(50, A3, B3)");

        // NxM is not ok
        let e = &RunErrorMsg::NonLinearArray;
        expect_err(e, &g, "XLOOKUP(50, A1:B4, A5:B8)");

        // Mismatch is not ok (vertical)
        eval_to_err(&g, "XLOOKUP(50, A1:A4, B1:B5)"); // too long
        eval_to_err(&g, "XLOOKUP(50, A1:A4, B1:B3)"); // too short
        eval_to_err(&g, "XLOOKUP(50, A1:A4, B1)"); // too short (single cell)
        eval_to_err(&g, "XLOOKUP(50, A1:A4, B1:E1)"); // different axis

        // Mismatch is not ok (horizontal)
        eval_to_err(&g, "XLOOKUP(50, A4:D4, A1:E1)"); // too long
        eval_to_err(&g, "XLOOKUP(50, A4:D4, A1:C1)"); // too short
        eval_to_err(&g, "XLOOKUP(50, A4:D4, A1)"); // too short (single cell)
        eval_to_err(&g, "XLOOKUP(50, A4:D4, E1:E4)"); // different axis

        // Multiple return values is ok
        eval_to_string(&g, "XLOOKUP(50, A1:A4, B1:C4)");
        eval_to_string(&g, "XLOOKUP(50, A1:A4, B1:C4)");

        // Multiple needle values is ok if it matches the return values
        fn make_test_formula(needle_size: (u32, u32), returns_size: (u32, u32)) -> String {
            let needle_size = ArraySize::try_from(needle_size).unwrap();
            let needle =
                Array::new_row_major(needle_size, smallvec![1.into(); needle_size.len()]).unwrap();

            let returns_size = ArraySize::try_from(returns_size).unwrap();
            let returns =
                Array::new_row_major(returns_size, smallvec!["ret".into(); returns_size.len()])
                    .unwrap();

            format!("XLOOKUP({}, A1:A4, {})", needle.repr(), returns.repr())
        }
        // (needles_w, needles_h), (returns_w, returns_h)
        eval_to_string(&g, &make_test_formula((2, 2), (1, 4)));
        eval_to_string(&g, &make_test_formula((2, 2), (2, 4)));
        eval_to_string(&g, &make_test_formula((3, 2), (3, 4)));
        eval_to_string(&g, &make_test_formula((3, 3), (3, 4)));
        eval_to_err(&g, &make_test_formula((2, 2), (3, 4)));
        eval_to_err(&g, &make_test_formula((2, 3), (3, 4)));
    }

    /// Test XLOOKUP's various search modes.
    #[test]
    fn test_xlookup_search_modes() {
        // #[track_caller]
        fn test_exact_xlookup_with_array(
            array: &Array,
            columns_to_search: &[i64],
            extra_params: &str,
        ) {
            let w = array.width() as i64;
            let h = array.height() as i64;
            let grid_vlookup = GridController::from_grid(Grid::from_array(pos![A1], array), 0);
            let grid_hlookup =
                GridController::from_grid(Grid::from_array(pos![A1], &array.transpose()), 0);

            for &col in columns_to_search {
                for if_not_found in [CellValue::Blank, "default-value".into()] {
                    let if_not_found_repr = if_not_found.repr();

                    // Prepare vertical XLOOKUP call
                    let haystack_start = Pos { x: col + 1, y: 1 }.a1_string();
                    let haystack_end = Pos { x: col + 1, y: h }.a1_string();
                    let returns = Pos { x: w, y: h }.a1_string();
                    let v_params = format!(
                        "{haystack_start}:{haystack_end}, A1:{returns}, \
                         {if_not_found_repr}, {extra_params}",
                    );

                    // Prepare horizontal XLOOKUP call
                    let haystack_start = Pos { x: 1, y: col + 1 }.a1_string();
                    let haystack_end = Pos { x: h, y: col + 1 }.a1_string();
                    let returns = Pos { x: h, y: w }.a1_string();
                    let h_params = format!(
                        "{haystack_start}:{haystack_end}, A1:{returns}, \
                         {if_not_found_repr}, {extra_params}",
                    );

                    for row in array.rows() {
                        let needle = row[col as usize].repr();
                        let array_size = ArraySize::new(w as u32, 1).unwrap();
                        let expected =
                            Array::new_row_major(array_size, row.iter().cloned().collect())
                                .unwrap();

                        // Test vertical lookup
                        let formula = format!("XLOOKUP({needle}, {v_params})");
                        expect_val(expected.clone(), &grid_vlookup, &formula);

                        // Test horizontal lookup
                        let formula = format!("XLOOKUP({needle}, {h_params})");
                        expect_val(expected.transpose(), &grid_hlookup, &formula);
                    }

                    // Test `if_not_found`
                    for needle in &*VALUES_THAT_SHOULD_NEVER_MATCH {
                        let needle = needle.repr();
                        let v_formula = format!("XLOOKUP({needle}, {v_params})");
                        let h_formula = format!("XLOOKUP({needle}, {h_params})");

                        let v_result = eval(&grid_vlookup, &v_formula);
                        let h_result = eval(&grid_hlookup, &h_formula);
                        let results = [&v_result, &h_result]
                            .into_iter()
                            .flat_map(|a| a.cell_values_slice().unwrap());

                        if if_not_found.is_blank() {
                            for v in results {
                                assert_eq!(RunErrorMsg::NoMatch, v.error().unwrap().msg);
                            }
                        } else {
                            for v in results {
                                assert_eq!(if_not_found, *v);
                            }
                        }
                    }
                }
            }
        }

        let numbers = &*NUMBERS_LOOKUP_ARRAY;
        let reverse_numbers = numbers.flip_vertically();
        let strings = &*STRINGS_LOOKUP_ARRAY;
        let reverse_strings = strings.flip_vertically();

        // Test forward binary search
        test_exact_xlookup_with_array(numbers, &[0], "");
        test_exact_xlookup_with_array(numbers, &[0], ", 1");
        test_exact_xlookup_with_array(strings, &[0], "");
        test_exact_xlookup_with_array(strings, &[0], ", 1");

        // Test reverse binary search
        test_exact_xlookup_with_array(&reverse_numbers, &[0], "");
        test_exact_xlookup_with_array(&reverse_numbers, &[0], ", 1");
        test_exact_xlookup_with_array(&reverse_strings, &[0], "");
        test_exact_xlookup_with_array(&reverse_strings, &[0], ", 1");

        // Test forward linear search
        test_exact_xlookup_with_array(numbers, &[0, 1, 2], "");
        test_exact_xlookup_with_array(numbers, &[0, 1, 2], ", 1");
        test_exact_xlookup_with_array(strings, &[0, 1, 2], "");
        test_exact_xlookup_with_array(strings, &[0, 1, 2], ", 1");

        // Test reverse linear search
        test_exact_xlookup_with_array(numbers, &[0, 1, 2], "");
        test_exact_xlookup_with_array(numbers, &[0, 1, 2], ", 1");
        test_exact_xlookup_with_array(strings, &[0, 1, 2], "");
        test_exact_xlookup_with_array(strings, &[0, 1, 2], ", 1");

        // Test that forward and reverse linear search are capable of giving
        // different results
        let g = GridController::from_grid(
            Grid::from_array(
                pos![A1],
                &array![
                    1, "a";
                    2, "b";
                    1, "c";
                    3, "d";
                ],
            ),
            0,
        );
        expect_val(
            Array::from(CellValue::from("a")),
            &g,
            "XLOOKUP(1, A1:A3, B1:B3,,, 1)", // forward
        );
        expect_val(
            Array::from(CellValue::from("c")),
            &g,
            "XLOOKUP(1, A1:A4, B1:B4,,, -1)", // reverse
        );
    }

    /// Tests XLOOKUP's various match modes.
    #[test]
    fn test_xlookup_match_modes() {
        let numbers_grid =
            GridController::from_grid(Grid::from_array(pos![A1], &NUMBERS_LOOKUP_ARRAY), 0);
        let rev_numbers_grid = GridController::from_grid(
            Grid::from_array(pos![A1], &NUMBERS_LOOKUP_ARRAY.flip_vertically()),
            0,
        );
        let mixed_grid =
            GridController::from_grid(Grid::from_array(pos![A1], &MIXED_LOOKUP_ARRAY), 0);

        // Get array heights
        let numbers_h = NUMBERS_LOOKUP_ARRAY.height();
        let mixed_h = MIXED_LOOKUP_ARRAY.height();

        let test_xlookup_comparison_match = |expected: &str, needle: &str, match_mode: i64| {
            for (grid, h, search_mode) in [
                (&mixed_grid, mixed_h, ""),             // linear forward (default)
                (&mixed_grid, mixed_h, ", 1"),          // linear forward
                (&mixed_grid, mixed_h, ", -1"),         // linear reverse
                (&numbers_grid, numbers_h, ", 2"),      // binary ascending
                (&rev_numbers_grid, numbers_h, ", -2"), // binary descending
            ] {
                assert_eq!(
                    expected,
                    eval_to_string(
                        grid,
                        &format!(
                            "XLOOKUP({needle}, A1:A{h}, A1:C{h}, 'x', \
                                     {match_mode}{search_mode})",
                        ),
                    ),
                );
            }
        };

        // Test exact search
        test_xlookup_comparison_match("{x, x, x}", "-1", 0);
        test_xlookup_comparison_match("{x, x, x}", "5", 0);
        test_xlookup_comparison_match("{x, x, x}", "9999", 0);

        // Test "next smaller" search
        test_xlookup_comparison_match("{x, x, x}", "-1", -1);
        test_xlookup_comparison_match("{1, one, wan}", "1", -1);
        test_xlookup_comparison_match("{1, one, wan}", "1.5", -1);
        test_xlookup_comparison_match("{2, two, tu}", "2", -1);
        test_xlookup_comparison_match("{2, two, tu}", "5", -1);
        test_xlookup_comparison_match("{50, fifty, mute}", "50", -1);
        test_xlookup_comparison_match("{50, fifty, mute}", "75", -1);
        test_xlookup_comparison_match("{100, hundred, ale}", "100", -1);
        test_xlookup_comparison_match("{100, hundred, ale}", "9999", -1);

        // Test "next larger" search
        test_xlookup_comparison_match("{1, one, wan}", "-1", 1);
        test_xlookup_comparison_match("{1, one, wan}", "1", 1);
        test_xlookup_comparison_match("{2, two, tu}", "1.5", 1);
        test_xlookup_comparison_match("{2, two, tu}", "2", 1);
        test_xlookup_comparison_match("{50, fifty, mute}", "5", 1);
        test_xlookup_comparison_match("{50, fifty, mute}", "50", 1);
        test_xlookup_comparison_match("{100, hundred, ale}", "75", 1);
        test_xlookup_comparison_match("{100, hundred, ale}", "100", 1);
        test_xlookup_comparison_match("{x, x, x}", "9999", 1);

        // Test wildcard search
        let g = GridController::from_grid(Grid::from_array(pos![A1], &MIXED_LOOKUP_ARRAY), 0);
        assert_eq!(
            "{bread}",
            eval_to_string(&g, "XLOOKUP('b*', A1:A20, A1:A20,, 2)"),
        ); // linear forward (default)
        assert_eq!(
            "{bread}",
            eval_to_string(&g, "XLOOKUP('b*', A1:A20, A1:A20,, 2, 1)"),
        ); // linear forward
        assert_eq!(
            "{BAnAnA}",
            eval_to_string(&g, "XLOOKUP('b*', A1:A20, A1:A20,, 2, -1)"),
        ); // linear reverse
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "XLOOKUP('b*', A1:A20, A1:A20,, 2, 2)", // binary ascending (invalid!)
        );
        expect_err(
            &RunErrorMsg::InvalidArgument,
            &g,
            "XLOOKUP('b*', A1:A20, A1:A20,, 2, -2)", // binary descending (invalid!)
        );
    }

    /// Test XLOOKUP's zip mapping, which is completely orthogonal to its search
    /// modes.
    #[test]
    fn test_xlookup_zip_map() {
        let array = &*NUMBERS_LOOKUP_ARRAY;
        let g = GridController::from_grid(Grid::from_array(pos![A1], array), 0);

        let formula = "XLOOKUP({1, 2, 3; 4, 50, 100}, A1:A4, A1:C4, {'a', 'b', 'c'})";
        assert_eq!(
            "{1, two, c; \
              a, fifty, ale}",
            eval_to_string(&g, formula),
        );

        let formula = "XLOOKUP({1; 4}, A1:A4, A1:C4, {'a', 'b', 'c'})";
        assert_eq!(
            "{1, one, wan; \
              a, b, c}",
            eval_to_string(&g, formula),
        );

        let formula = "XLOOKUP({1; 4}, A1:A4, A1:C4, 'a')";
        assert_eq!(
            "{1, one, wan; \
              a, a, a}",
            eval_to_string(&g, formula),
        );
    }

    #[test]
    fn test_xlookup() {
        let mut g = GridController::from_grid(Grid::new(), 0);
        let sheet_id = g.sheet_ids()[0];
        for y in 1..=6 {
            g.set_cell_value(pos![sheet_id!1,y], y.to_string(), None, false);
            g.set_cell_value(pos![sheet_id!2,y], format!("cell #{y}"), None, false);
        }

        // Test lookup in sorted array
        for i in 1..=6 {
            assert_eq!(
                format!("{{cell #{i}}}"),
                eval_to_string(&g, &format!("XLOOKUP({i}, A1:A6, B1:B6)")),
            );
        }
    }

    #[test]
    fn test_match() {
        let mut g = GridController::from_grid(Grid::test(), 0);
        let sheet_id = g.sheet_ids()[0];

        // Produce the following grid:
        // 11 21 31 41 51 61
        // 12 22 32 42 52 62
        // 13 23 33 43 53 63
        // 14 24 34 44 54 64
        // 15 25 35 45 55 65
        // 16 26 36 46 56 66
        for x in 1..=6 {
            for y in 1..=6 {
                g.set_cell_value(pos![sheet_id!x,y], (x * 10 + y).to_string(), None, false);
            }
        }

        // crate::test_util::print_table_sheet(sheet, Rect::new_span(pos![A1], pos![F6]));

        // next smaller (horizontal)
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "MATCH(10, A1:A6)").msg
        );
        assert_eq!("1", eval_to_string(&g, "MATCH(11, A1:A6)"));
        assert_eq!("2", eval_to_string(&g, "MATCH(12.9, A1:A6)"));
        assert_eq!("6", eval_to_string(&g, "MATCH(99999, A1:A6)"));

        // next smaller (vertical)
        assert_eq!("1", eval_to_string(&g, "MATCH(11, A1:F1)"));
        assert_eq!("4", eval_to_string(&g, "MATCH(50, A1:F1)"));
        assert_eq!("6", eval_to_string(&g, "MATCH(99999, A1:F1)"));

        // single cell range
        assert_eq!(RunErrorMsg::NoMatch, eval_to_err(&g, "MATCH(10, A1)").msg);
        assert_eq!("1", eval_to_string(&g, "MATCH(11, A1)"));
        assert_eq!("1", eval_to_string(&g, "MATCH(12, A1)"));

        // error on bad range
        assert_eq!(
            RunErrorMsg::NonLinearArray,
            eval_to_err(&g, "MATCH(99999, A1:F6)").msg,
        );

        // next larger
        let make_match_formula_str =
            |search_key| format!("MATCH({search_key}, {{16, 15, 14, 13, 12, 11}}, -1)");
        assert_eq!("6", eval_to_string(&g, &make_match_formula_str(-999999.0)));
        assert_eq!("4", eval_to_string(&g, &make_match_formula_str(12.9)));
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, &make_match_formula_str(999999.0)).msg,
        );

        // equal
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "MATCH(0, B3:B5, 0)").msg,
        );
        assert_eq!("1", eval_to_string(&g, "MATCH(23, B3:B5, 0)"));
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "MATCH(24.5, B3:B5, 0)").msg,
        );
        assert_eq!("3", eval_to_string(&g, "MATCH(25, B3:B5, 0)"));
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "MATCH(99999, B3:B5, 0)").msg,
        );

        // wildcard
        let make_match_formula_str =
            |search_key| format!("MATCH(\"{search_key}\", {{\"lipu\", \"nanpa\", \"suli\"}}, 0)");
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, &make_match_formula_str("U*")).msg,
        );
        assert_eq!("1", eval_to_string(&g, &make_match_formula_str("*U")));
        assert_eq!("2", eval_to_string(&g, &make_match_formula_str("Na?pa")));

        // with `MAX` (horizontal)
        let source_array = array![
            65373.84, 41042.03, 29910.73, 31197.02, 67365.77, 31496.82, 78505.27, 38149.34
        ];
        let g = GridController::from_grid(Grid::from_array(pos![C1], &source_array), 0);
        assert_eq!(eval_to_string(&g, "=MATCH(MAX(C1:J1), C1:J1, 0)"), "7");
        // with `MAX` (vertical)
        let g = GridController::from_grid(Grid::from_array(pos![C1], &source_array.transpose()), 0);
        assert_eq!(eval_to_string(&g, "=MATCH(MAX(C1:C8), C1:C8, 0)"), "7");
    }

    #[test]
    fn test_lookup() {
        let g = GridController::new();

        // Basic LOOKUP with array - finds exact match
        assert_eq!("3", eval_to_string(&g, "LOOKUP(3, {1, 2, 3, 4, 5})"));

        // LOOKUP finds largest value less than or equal to lookup_value
        assert_eq!("2", eval_to_string(&g, "LOOKUP(2.5, {1, 2, 3, 4, 5})"));
        assert_eq!("5", eval_to_string(&g, "LOOKUP(10, {1, 2, 3, 4, 5})"));

        // LOOKUP with separate result array
        assert_eq!(
            "c",
            eval_to_string(
                &g,
                "LOOKUP(3, {1, 2, 3, 4, 5}, {\"a\", \"b\", \"c\", \"d\", \"e\"})"
            )
        );
        assert_eq!(
            "b",
            eval_to_string(
                &g,
                "LOOKUP(2.5, {1, 2, 3, 4, 5}, {\"a\", \"b\", \"c\", \"d\", \"e\"})"
            )
        );

        // LOOKUP with column vectors
        assert_eq!("3", eval_to_string(&g, "LOOKUP(3, {1; 2; 3; 4; 5})"));
        assert_eq!(
            "c",
            eval_to_string(
                &g,
                "LOOKUP(3, {1; 2; 3; 4; 5}, {\"a\"; \"b\"; \"c\"; \"d\"; \"e\"})"
            )
        );

        // LOOKUP with strings (sorted alphabetically)
        assert_eq!(
            "2",
            eval_to_string(
                &g,
                "LOOKUP(\"banana\", {\"apple\", \"banana\", \"cherry\"}, {1, 2, 3})"
            )
        );

        // Error: no match (all values greater than lookup_value)
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "LOOKUP(0, {1, 2, 3, 4, 5})").msg,
        );

        // Error: array size mismatch
        assert_eq!(
            RunErrorMsg::ArrayAxisMismatch {
                axis: Axis::X,
                expected: 3,
                got: 2,
            },
            eval_to_err(&g, "LOOKUP(3, {1, 2, 3}, {\"a\", \"b\"})").msg,
        );
    }

    #[test]
    fn test_xmatch() {
        let g = GridController::new();

        // Basic exact match (default match_mode = 0)
        assert_eq!(
            "2",
            eval_to_string(&g, "XMATCH(\"b\", {\"a\", \"b\", \"c\"})")
        );
        assert_eq!(
            "1",
            eval_to_string(&g, "XMATCH(\"a\", {\"a\", \"b\", \"c\"})")
        );
        assert_eq!(
            "3",
            eval_to_string(&g, "XMATCH(\"c\", {\"a\", \"b\", \"c\"})")
        );

        // Exact match with numbers
        assert_eq!("3", eval_to_string(&g, "XMATCH(5, {1, 3, 5, 7, 9}, 0)"));
        assert_eq!("1", eval_to_string(&g, "XMATCH(1, {1, 3, 5, 7, 9}, 0)"));
        assert_eq!("5", eval_to_string(&g, "XMATCH(9, {1, 3, 5, 7, 9}, 0)"));

        // No match returns error
        assert_eq!(
            RunErrorMsg::NoMatch,
            eval_to_err(&g, "XMATCH(4, {1, 3, 5, 7, 9}, 0)").msg,
        );

        // match_mode = 1 (exact or next larger)
        assert_eq!("3", eval_to_string(&g, "XMATCH(4, {1, 3, 5, 7, 9}, 1)"));
        assert_eq!("3", eval_to_string(&g, "XMATCH(5, {1, 3, 5, 7, 9}, 1)"));
        assert_eq!("1", eval_to_string(&g, "XMATCH(0, {1, 3, 5, 7, 9}, 1)"));

        // match_mode = -1 (exact or next smaller)
        assert_eq!("2", eval_to_string(&g, "XMATCH(4, {1, 3, 5, 7, 9}, -1)"));
        assert_eq!("3", eval_to_string(&g, "XMATCH(5, {1, 3, 5, 7, 9}, -1)"));
        assert_eq!("5", eval_to_string(&g, "XMATCH(100, {1, 3, 5, 7, 9}, -1)"));

        // match_mode = 2 (wildcard)
        assert_eq!(
            "2",
            eval_to_string(&g, "XMATCH(\"b*\", {\"apple\", \"banana\", \"cherry\"}, 2)")
        );
        assert_eq!(
            "1",
            eval_to_string(&g, "XMATCH(\"a*\", {\"apple\", \"banana\", \"cherry\"}, 2)")
        );
        assert_eq!(
            "3",
            eval_to_string(&g, "XMATCH(\"c*\", {\"apple\", \"banana\", \"cherry\"}, 2)")
        );

        // search_mode = -1 (reverse search)
        assert_eq!(
            "5",
            eval_to_string(
                &g,
                "XMATCH(\"a\", {\"a\", \"b\", \"c\", \"d\", \"a\"}, 0, -1)"
            )
        );

        // search_mode = 2 (binary search ascending)
        assert_eq!("3", eval_to_string(&g, "XMATCH(5, {1, 3, 5, 7, 9}, 0, 2)"));

        // search_mode = -2 (binary search descending)
        assert_eq!("3", eval_to_string(&g, "XMATCH(5, {9, 7, 5, 3, 1}, 0, -2)"));

        // Column vector
        assert_eq!(
            "2",
            eval_to_string(&g, "XMATCH(\"b\", {\"a\"; \"b\"; \"c\"})")
        );

        // Error: wildcard with binary search not allowed
        assert_eq!(
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "XMATCH(\"a*\", {\"a\", \"b\", \"c\"}, 2, 2)").msg,
        );

        // Error: non-linear array
        assert_eq!(
            RunErrorMsg::NonLinearArray,
            eval_to_err(&g, "XMATCH(1, {1, 2; 3, 4})").msg,
        );
    }
}
