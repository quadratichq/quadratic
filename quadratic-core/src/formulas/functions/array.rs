use smallvec::smallvec;

use super::*;
use crate::ArraySize;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Array functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![formula_fn!(
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
        #[examples("FILTER(A1:C5, D1:D5, )")]
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
                    let mut matches = 0;
                    let mut return_values = smallvec![];
                    let perpendicular_len = array.inner.size()[axis.other_axis()].get();
                    for i in include.iter().positions(|&x| x) {
                        matches += 1;
                        let i = i as u32;
                        for j in 0..perpendicular_len {
                            let v = match axis {
                                Axis::X => array.inner.get(i, j),
                                Axis::Y => array.inner.get(j, i),
                            };
                            return_values.push(v.map_err(|e| e.with_span(span))?.clone());
                        }
                    }
                    let return_array_size = ArraySize::new(perpendicular_len, matches);
                    match return_array_size {
                        None => empty_result?,
                        Some(size) => {
                            let a = Array::new_row_major(size, return_values)?;
                            Value::from(match axis {
                                Axis::X => a.transpose(),
                                Axis::Y => a,
                            })
                        }
                    }
                }
            }
        }
    )]
}

#[cfg(test)]
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
            eval_to_err(&g, "FILTER(A1:C5, {0;0;0;0;0}").msg,
        );
        assert_eq!(
            "oh no",
            eval_to_string(&g, "FILTER(A1:C5, {0;0;0;0;0}, 'oh no'"),
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
            RunErrorMsg::InvalidArgument,
            eval_to_err(&g, "FILTER(A1:E3, {0,1,-6,'a',TRUE}, 'oh no')").msg,
        )
    }
}
