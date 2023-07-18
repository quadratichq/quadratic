use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Statistics functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns the arithmetic mean of all values.
            #[examples("AVERAGE(A1:A6)", "AVERAGE(A1, A3, A5, B1:B6)")]
            fn AVERAGE(span: Span, numbers: (Iter<f64>)) {
                util::average(span, numbers)
            }
        ),
        formula_fn!(
            /// Evaluates each value based on some criteria, and then computes
            /// the arithmetic mean of the ones that meet those criteria. If
            /// `range_to_average` is given, then values in `range_to_average`
            /// are averaged instead wherever the corresponding value in
            /// `range_to_evaluate` meets the criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "AVERAGEIF(A1:A10, \"2\")",
                "AVERAGEIF(A1:A10, \">0\")",
                "AVERAGEIF(A1:A10, \"<>INVALID\", B1:B10)"
            )]
            #[pure_zip_map]
            fn AVERAGEIF(
                span: Span,
                eval_range: (Spanned<Array>),
                [criteria]: (Spanned<BasicValue>),
                numbers_range: (Option<Spanned<Array>>),
            ) {
                let criteria = Criterion::try_from(*criteria)?;
                let numbers =
                    criteria.iter_matching_coerced::<f64>(eval_range, numbers_range.as_ref())?;
                util::average(span, numbers)
            }
        ),
        formula_fn!(
            /// Returns the number of numeric values.
            ///
            /// - Blank cells are not counted.
            /// - Cells containing an error are not counted.
            #[examples("COUNT(A1:C42, E17)", "SUM(A1:A10) / COUNT(A1:A10)")]
            fn COUNT(numbers: (Iter<BasicValue>)) {
                // Ignore error values.
                numbers
                    .filter(|x| matches!(x, Ok(BasicValue::Number(_))))
                    .count() as f64
            }
        ),
        formula_fn!(
            /// Returns the number of non-blank values.
            ///
            /// - Cells with formula or code output of an empty string are
            ///   counted.
            /// - Cells containing zero are counted.
            /// - Cells with an error are counted.
            #[examples("COUNTA(A1:A10)")]
            fn COUNTA(range: (Iter<BasicValue>)) {
                // Count error values.
                range.filter_ok(|v| !v.is_blank()).count() as f64
            }
        ),
        formula_fn!(
            /// Evaluates each value based on some criteria, and then counts
            /// how many values meet those criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "COUNTIF(A1:A10, \"2\")",
                "COUNTIF(A1:A10, \">0\")",
                "COUNTIF(A1:A10, \"<>INVALID\")"
            )]
            #[pure_zip_map]
            fn COUNTIF(range: (Spanned<Array>), [criteria]: (Spanned<BasicValue>)) {
                let criteria = Criterion::try_from(*criteria)?;
                // Ignore error values.
                let count = criteria.iter_matching(range, None)?.count();
                count as f64
            }
        ),
        formula_fn!(
            /// Counts how many values in the range are empty.
            ///
            /// - Cells with formula or code output of an empty string are
            ///   counted.
            /// - Cells containing zero are not counted.
            /// - Cells with an error are not counted.
            #[examples("COUNTBLANK(A1:A10)")]
            fn COUNTBLANK(range: (Iter<BasicValue>)) {
                // Ignore error values.
                range
                    .filter_map(|v| v.ok())
                    .filter(|v| v.is_blank_or_empty_string())
                    .count() as f64
            }
        ),
        formula_fn!(
            /// Returns the smallest value.
            /// Returns +∞ if given no values.
            #[examples("MIN(A1:A6)", "MIN(0, A1:A6)")]
            fn MIN(numbers: (Iter<f64>)) {
                numbers.try_fold(f64::INFINITY, |a, b| Ok(f64::min(a, b?)))
            }
        ),
        formula_fn!(
            /// Returns the largest value.
            /// Returns -∞ if given no values.
            #[examples("MAX(A1:A6)", "MAX(0, A1:A6)")]
            fn MAX(numbers: (Iter<f64>)) {
                numbers.try_fold(-f64::INFINITY, |a, b| Ok(f64::max(a, b?)))
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_average() {
        let form = parse_formula("AVERAGE(3, B1:D3)", pos![nAn1]).unwrap();

        let g = &mut FnGrid(|pos| {
            if (1..=3).contains(&pos.x) && (1..=3).contains(&pos.y) {
                Some((pos.x * 3 + pos.y).to_string()) // 4 .. 12
            } else {
                panic!("cell {pos} shouldn't be accessed")
            }
        });

        assert_eq!(
            "7.5".to_string(),
            form.eval_blocking(g, pos![nAn1]).unwrap().to_string(),
        );

        assert_eq!(
            "17",
            eval_to_string(g, "AVERAGE({\"_\", \"a\"}, 12, -3.5, 42.5)"),
        );
        assert_eq!("5.5", eval_to_string(g, "AVERAGE(1..10)"));
        assert_eq!("5", eval_to_string(g, "AVERAGE(0..10)"));

        // Test that null arguments count as zero.
        assert_eq!("1", eval_to_string(g, "AVERAGE(3,,)"));
        assert_eq!("1", eval_to_string(g, "AVERAGE(,3,)"));
        assert_eq!("1", eval_to_string(g, "AVERAGE(,,3)"));
        assert_eq!("0", eval_to_string(g, "AVERAGE(,)"));

        // Test with no arguments
        assert_eq!(
            FormulaErrorMsg::DivideByZero,
            eval_to_err(g, "AVERAGE()").msg,
        );
    }

    #[test]
    fn test_averageif() {
        let g = &mut NoGrid;

        assert_eq!("2.5", eval_to_string(g, "AVERAGEIF(0..10, \"<=5\")"));
        assert_eq!("2.5", eval_to_string(g, "AVERAGEIF(0..10, \"<=5\")"));

        // Blank values are treated as zeros when summing, but *not* when
        // evaluating conditions.
        let g = &mut FnGrid(|pos| (pos.y >= 0).then(|| pos.y));
        assert_eq!("2.5", eval_to_string(g, "AVERAGEIF(Bn5:B10, \"<=5\")"));
        let g = &mut BlankGrid;
        assert_eq!(
            "7.5",
            eval_to_string(g, "AVERAGEIF({0, 0, 0}, \"<=5\", {5, 10, B3})"),
        );

        // Error on range size mismatch.
        assert_eq!(
            FormulaErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize { w: 1, h: 11 },
                got: ArraySize { w: 2, h: 1 },
            },
            eval_to_err(g, "AVERAGEIF(0..10, \"<=5\", {A1, A2})").msg,
        );
        // ... even if one of the arguments is just a single value.
        assert_eq!(
            FormulaErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize { w: 1, h: 11 },
                got: ArraySize { w: 1, h: 1 },
            },
            eval_to_err(g, "AVERAGEIF(0..10, \"<=5\", 3)").msg,
        );
        assert_eq!(
            FormulaErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize { w: 1, h: 1 },
                got: ArraySize { w: 1, h: 11 },
            },
            eval_to_err(g, "AVERAGEIF(3, \"<=5\", 0..10)").msg,
        );
    }

    #[test]
    fn test_count() {
        let g = &mut BlankGrid;
        assert_eq!("0", eval_to_string(g, "COUNT()"));
        assert_eq!("0", eval_to_string(g, "COUNT(A1)"));
        assert_eq!("0", eval_to_string(g, "COUNT(A1:B4)"));
        assert_eq!(
            "3",
            eval_to_string(g, "COUNT(\"_\", \"a\", 12, -3.5, 42.5)"),
        );
        assert_eq!("1", eval_to_string(g, "COUNT(2)"));
        assert_eq!("10", eval_to_string(g, "COUNT(1..10)"));
        assert_eq!("11", eval_to_string(g, "COUNT(0..10)"));
        assert_eq!("1", eval_to_string(g, "COUNT({\"\",1,,,})"));
    }

    #[test]
    fn test_counta() {
        let g = &mut BlankGrid;
        assert_eq!("0", eval_to_string(g, "COUNTA()"));
        assert_eq!("0", eval_to_string(g, "COUNTA(A1)"));
        assert_eq!("0", eval_to_string(g, "COUNTA(A1:B4)"));
        assert_eq!(
            "5",
            eval_to_string(g, "COUNTA(\"_\", \"a\", 12, -3.5, 42.5)"),
        );
        assert_eq!("1", eval_to_string(g, "COUNTA(\"\")"));
        assert_eq!("1", eval_to_string(g, "COUNTA(2)"));
        assert_eq!("10", eval_to_string(g, "COUNTA(1..10)"));
        assert_eq!("11", eval_to_string(g, "COUNTA(0..10)"));
        assert_eq!("2", eval_to_string(g, "COUNTA({\"\",1,,,})"));
    }

    #[test]
    fn test_countif() {
        let g = &mut BlankGrid;
        assert_eq!("6", eval_to_string(g, "COUNTIF(0..10, \"<=5\")"));
        assert_eq!("6", eval_to_string(g, "COUNTIF(0..10, \"<=5\")"));

        // Test that blank cells are ignored
        let g = &mut FnGrid(|pos| (pos.y >= 0).then(|| pos.y));
        assert_eq!("6", eval_to_string(g, "COUNTIF(Bn5:B10, \"<=5\")"))
    }

    #[test]
    fn test_countblank() {
        let g = &mut BlankGrid;
        assert_eq!("1", eval_to_string(g, "COUNTBLANK(\"\")"));
        assert_eq!("0", eval_to_string(g, "COUNTBLANK(\"a\")"));
        assert_eq!("0", eval_to_string(g, "COUNTBLANK(0)"));
        assert_eq!("0", eval_to_string(g, "COUNTBLANK(1)"));
        assert_eq!("1", eval_to_string(g, "COUNTBLANK({\"\", \"a\"; 0, 1})"));
        assert_eq!("1", eval_to_string(g, "COUNTBLANK(B3)"));
        assert_eq!("28", eval_to_string(g, "COUNTBLANK(B3:C16)"));
        assert_eq!("3", eval_to_string(g, "COUNTBLANK({B3, \"\", C6, \"0\"})"));
    }

    #[test]
    fn test_min() {
        let g = &mut NoGrid;
        assert_eq!("1", eval_to_string(g, "MIN(1, 3, 2)"));
    }

    #[test]
    fn test_max() {
        let g = &mut NoGrid;
        assert_eq!("3", eval_to_string(g, "MAX(1, 3, 2)"));
    }
}
