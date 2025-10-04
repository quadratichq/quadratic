use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Statistics functions",
    docs: None,
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns the arithmetic mean of all values.
            #[examples("AVERAGE(A1:A6)", "AVERAGE(A1, A3, A5, B1:B6)")]
            fn AVERAGE(span: Span, numbers: (Iter<f64>)) {
                CellValue::average(span, numbers)
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
            #[zip_map]
            fn AVERAGEIF(
                span: Span,
                eval_range: (Spanned<Array>),
                [criteria]: (Spanned<CellValue>),
                numbers_range: (Option<Spanned<Array>>),
            ) {
                let criteria = Criterion::try_from(*criteria)?;
                let numbers =
                    criteria.iter_matching_coerced::<f64>(eval_range, numbers_range.as_ref())?;
                CellValue::average(*span, numbers)
            }
        ),
        formula_fn!(
            /// Returns the number of numeric values.
            ///
            /// - Blank cells are not counted.
            /// - Cells containing an error are not counted.
            #[examples("COUNT(A1:C42, E17)", "SUM(A1:A10) / COUNT(A1:A10)")]
            fn COUNT(numbers: (Iter<CellValue>)) {
                // Ignore error values.
                numbers
                    .filter(|x| matches!(x, Ok(CellValue::Number(_))))
                    .count()
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
            fn COUNTA(range: (Iter<CellValue>)) {
                // Count error values.
                range.filter_ok(|v| !v.is_blank()).count()
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
            #[zip_map]
            fn COUNTIF(range: (Spanned<Array>), [criteria]: (Spanned<CellValue>)) {
                let criteria = Criterion::try_from(*criteria)?;
                // Ignore error values.
                // The `let` binding is necessary to avoid a lifetime error.
                #[allow(clippy::let_and_return)]
                let count = criteria.iter_matching(range, None)?.count();
                count
            }
        ),
        formula_fn!(
            /// Evaluates multiple values on they're respective criteria, and
            /// then counts how many sets of values met all their criteria.
            #[doc = see_docs_for_more_about_criteria!()]
            #[examples(
                "COUNTIFS(\"<>INVALID\", B1:B10)",
                "COUNTIFS(\"<>INVALID\", B1:B10, \"<=0\", C1:C10)"
            )]
            fn COUNTIFS(
                ctx: Ctx,
                eval_range1: (Spanned<Array>),
                criteria1: (Spanned<Value>),
                more_eval_ranges_and_criteria: FormulaFnArgs,
            ) {
                ctx.zip_map_eval_ranges_and_criteria_from_args(
                    eval_range1,
                    criteria1,
                    more_eval_ranges_and_criteria,
                    |_ctx, eval_ranges_and_criteria| {
                        // Same as `COUNTIF`
                        let count =
                            Criterion::iter_matching_multi(&eval_ranges_and_criteria, None)?
                                .count();
                        Ok((count as f64).into())
                    },
                )?
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
            fn COUNTBLANK(range: (Iter<CellValue>)) {
                // Ignore error values.
                range
                    .filter_map(|v| v.ok())
                    .filter(|v| v.is_blank_or_empty_string())
                    .count()
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
        formula_fn!(
            /// Returns the variance of all values (sample variance).
            /// Uses the formula: Σ(x - μ)²/(n-1) where μ is the mean and n is the count.
            #[examples("VAR(A1:A6)", "VAR(1, 2, 3, 4, 5)")]
            fn VAR(numbers: (Iter<f64>)) {
                let mut sum = 0.0;
                let mut sum_sq = 0.0;
                let mut count = 0;

                for num in numbers {
                    let val = num?;
                    sum += val;
                    sum_sq += val * val;
                    count += 1;
                }

                let mean = sum / (count as f64);
                let variance = (sum_sq - sum * mean) / ((count - 1) as f64);
                Ok(CellValue::from(variance))
            }
        ),
        formula_fn!(
            /// Returns the standard deviation of all values (sample standard deviation).
            /// Uses the formula: √(Σ(x - μ)²/(n-1)) where μ is the mean and n is the count.
            #[examples("STDEV(A1:A6)", "STDEV(1, 2, 3, 4, 5)")]
            fn STDEV(numbers: (Iter<f64>)) {
                let mut sum = 0.0;
                let mut sum_sq = 0.0;
                let mut count = 0;

                for x in numbers {
                    let x = x?;
                    sum += x;
                    sum_sq += x * x;
                    count += 1;
                }

                let mean = sum / (count as f64);
                let variance = (sum_sq - sum * mean) / ((count - 1) as f64);
                let stdev = variance.sqrt();

                Ok(CellValue::from(stdev))
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use itertools::Itertools;

    use crate::{
        Pos, a1::A1Context, controller::GridController, formulas::tests::*, grid::SheetId,
    };

    #[test]
    fn test_formula_average() {
        let parse_ctx = A1Context::test(&[], &[]);
        let pos = pos![A10].as_sheet_pos(SheetId::TEST);
        let form = parse_formula("AVERAGE(3, A1:C3)", &parse_ctx, pos).unwrap();

        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];
        for x in 1..=3 {
            for y in 1..=3 {
                g.set_cell_value(pos![sheet_id!x,y], (x * 3 + y).to_string(), None, false);
                println!(
                    "({},{})={:?}",
                    x,
                    y,
                    g.sheet(sheet_id).cell_value(Pos { x, y }).unwrap()
                );
            }
        }

        let mut ctx = Ctx::new(&g, pos![A10].as_sheet_pos(sheet_id));
        assert_eq!("7.5".to_string(), form.eval(&mut ctx).to_string());

        assert_eq!(
            "17",
            eval_to_string(&g, "AVERAGE({\"_\", \"a\"}, 12, -3.5, 42.5)"),
        );
        assert_eq!("5.5", eval_to_string(&g, "AVERAGE(1..10)"));
        assert_eq!("5", eval_to_string(&g, "AVERAGE(0..10)"));

        // Test that null arguments count as zero.
        assert_eq!("1", eval_to_string(&g, "AVERAGE(3,,)"));
        assert_eq!("1", eval_to_string(&g, "AVERAGE(,3,)"));
        assert_eq!("1", eval_to_string(&g, "AVERAGE(,,3)"));
        assert_eq!("0", eval_to_string(&g, "AVERAGE(,)"));

        // Test with no arguments
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.as_sheet_pos(g.sheet_ids()[0]));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "AVERAGE".into(),
                arg_name: "numbers".into()
            },
            simple_parse_formula("AVERAGE()")
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
    }

    #[test]
    fn test_averageif() {
        let g = GridController::new();

        assert_eq!("2.5", eval_to_string(&g, "AVERAGEIF(0..10, \"<=5\")"));
        assert_eq!("2.5", eval_to_string(&g, "AVERAGEIF(0..10, \"<=5\")"));

        // Blank values are treated as zeros when summing, but *not* when
        // evaluating conditions.
        {
            let mut g = GridController::new();
            let sheet_id = g.sheet_ids()[0];
            for y in 1..=11 {
                g.set_cell_value(pos![sheet_id!1,y], (y - 1).to_string(), None, false);
            }
            assert_eq!("2.5", eval_to_string(&g, "AVERAGEIF(A1:A10, \"<=5\")"));
        }
        let g = GridController::new();
        assert_eq!(
            "7.5",
            eval_to_string(&g, "AVERAGEIF({0, 0, 0}, \"<=5\", {5, 10, A2})"),
        );

        // Error on range size mismatch.
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(1, 11).unwrap(),
                got: ArraySize::new(2, 1).unwrap(),
            },
            eval_to_err(&g, "AVERAGEIF(0..10, \"<=5\", {A1, A2})").msg,
        );
        // ... even if one of the arguments is just a single value.
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(1, 11).unwrap(),
                got: ArraySize::new(1, 1).unwrap(),
            },
            eval_to_err(&g, "AVERAGEIF(0..10, \"<=5\", 3)").msg,
        );
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(1, 1).unwrap(),
                got: ArraySize::new(1, 11).unwrap(),
            },
            eval_to_err(&g, "AVERAGEIF(3, \"<=5\", 0..10)").msg,
        );
    }

    #[test]
    fn test_count() {
        let g = GridController::new();
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.as_sheet_pos(g.sheet_ids()[0]));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "COUNT".into(),
                arg_name: "numbers".into()
            },
            simple_parse_formula("COUNT()")
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
        assert_eq!("0", eval_to_string(&g, "COUNT(A1)"));
        assert_eq!("0", eval_to_string(&g, "COUNT(A1:B4)"));
        assert_eq!(
            "3",
            eval_to_string(&g, "COUNT(\"_\", \"a\", 12, -3.5, 42.5)"),
        );
        assert_eq!("1", eval_to_string(&g, "COUNT(2)"));
        assert_eq!("10", eval_to_string(&g, "COUNT(1..10)"));
        assert_eq!("11", eval_to_string(&g, "COUNT(0..10)"));
        assert_eq!("1", eval_to_string(&g, "COUNT({\"\",1,,,})"));
    }

    #[test]
    fn test_counta() {
        let g = GridController::new();
        let mut ctx = Ctx::new(&g, Pos::ORIGIN.as_sheet_pos(g.sheet_ids()[0]));
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "COUNTA".into(),
                arg_name: "range".into()
            },
            simple_parse_formula("COUNTA()")
                .unwrap()
                .eval(&mut ctx)
                .unwrap_err()
                .msg,
        );
        assert_eq!("0", eval_to_string(&g, "COUNTA(A1)"));
        assert_eq!("0", eval_to_string(&g, "COUNTA(A1:B4)"));
        assert_eq!(
            "5",
            eval_to_string(&g, "COUNTA(\"_\", \"a\", 12, -3.5, 42.5)"),
        );
        assert_eq!("1", eval_to_string(&g, "COUNTA(\"\")"));
        assert_eq!("1", eval_to_string(&g, "COUNTA(2)"));
        assert_eq!("10", eval_to_string(&g, "COUNTA(1..10)"));
        assert_eq!("11", eval_to_string(&g, "COUNTA(0..10)"));
        assert_eq!("2", eval_to_string(&g, "COUNTA({\"\",1,,,})"));
    }

    #[test]
    fn test_countif() {
        let g = GridController::new();
        assert_eq!("6", eval_to_string(&g, "COUNTIF(0..10, \"<=5\")"));
        assert_eq!("6", eval_to_string(&g, "COUNTIF(0..10, \"<=5\")"));

        // Test that blank cells are ignored
        let mut g = GridController::new();
        let sheet_id = g.sheet_ids()[0];
        for y in 1..=11 {
            g.set_cell_value(pos![sheet_id!1,y], (y - 1).to_string(), None, false);
        }
        assert_eq!("6", eval_to_string(&g, "COUNTIF(A1:A10, \"<=5\")"));
    }

    #[test]
    fn test_countifs() {
        let g = GridController::new();
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "COUNTIFS".into(),
                arg_name: "eval_range1".into(),
            },
            eval_to_err(&g, "COUNTIFS()").msg,
        );
        assert_eq!(
            RunErrorMsg::MissingRequiredArgument {
                func_name: "COUNTIFS".into(),
                arg_name: "criteria1".into(),
            },
            eval_to_err(&g, "COUNTIFS(0..10)").msg,
        );

        let make_countifs =
            |conditions: &[&str]| format!("COUNTIFS({})", conditions.iter().join(", "));

        // vertical; first 6 elements match
        let cond1 = "0..10, \"<=5\"";
        assert_eq!("6", eval_to_string(&g, &make_countifs(&[cond1])));

        // vertical; alternating elements match
        let cond2 = "MOD(5..15, 2), 1";
        assert_eq!("6", eval_to_string(&g, &make_countifs(&[cond2])));
        assert_eq!("3", eval_to_string(&g, &make_countifs(&[cond1, cond2])));

        // horizontal; last 3 elements match
        let cond3 = "{1,2,3,4,5,6,7,8,9,10,11}, \">8\"";
        assert_eq!("3", eval_to_string(&g, &make_countifs(&[cond3])));
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(11, 1).unwrap(),
                got: ArraySize::new(1, 11).unwrap(),
            },
            eval_to_err(&g, &make_countifs(&[cond1, cond3])).msg,
        );
        assert_eq!(
            RunErrorMsg::ExactArraySizeMismatch {
                expected: ArraySize::new(11, 1).unwrap(),
                got: ArraySize::new(1, 11).unwrap(),
            },
            eval_to_err(&g, &make_countifs(&[cond1, cond2, cond3])).msg,
        );

        // vertical; last 3 elements match
        let cond4 = "1..11, \">8\"";
        assert_eq!("3", eval_to_string(&g, &make_countifs(&[cond4])));
        assert_eq!("0", eval_to_string(&g, &make_countifs(&[cond1, cond4])));
        assert_eq!("2", eval_to_string(&g, &make_countifs(&[cond2, cond4])));
        assert_eq!(
            "0",
            eval_to_string(&g, &make_countifs(&[cond1, cond2, cond4])),
        );
    }

    #[test]
    fn test_countblank() {
        let g = GridController::new();
        assert_eq!("1", eval_to_string(&g, "COUNTBLANK(\"\")"));
        assert_eq!("0", eval_to_string(&g, "COUNTBLANK(\"a\")"));
        assert_eq!("0", eval_to_string(&g, "COUNTBLANK(0)"));
        assert_eq!("0", eval_to_string(&g, "COUNTBLANK(1)"));
        assert_eq!("1", eval_to_string(&g, "COUNTBLANK({\"\", \"a\"; 0, 1})"));
        assert_eq!("1", eval_to_string(&g, "COUNTBLANK(B3)"));
        assert_eq!("28", eval_to_string(&g, "COUNTBLANK(B3:C16)"));
        assert_eq!("3", eval_to_string(&g, "COUNTBLANK({B3, \"\", C6, \"0\"})"));
    }

    #[test]
    fn test_min() {
        let g = GridController::new();
        assert_eq!("1", eval_to_string(&g, "MIN(1, 3, 2)"));
    }

    #[test]
    fn test_max() {
        let g = GridController::new();
        assert_eq!("3", eval_to_string(&g, "MAX(1, 3, 2)"));
    }

    #[test]
    fn test_var() {
        let g = GridController::new();

        // Test basic variance calculation
        assert_eq!("7", eval_to_string(&g, "VAR(9, 5, 4)"));
    }

    #[test]
    fn test_stdev() {
        let g = GridController::new();

        // Test basic standard deviation calculation
        assert_eq!("2", eval_to_string(&g, "STDEV(1, 3, 5)"));
    }
}
