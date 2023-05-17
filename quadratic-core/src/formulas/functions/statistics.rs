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
        FormulaFunction {
            name: "AVERAGE",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["AVERAGE(A1:A6)", "AVERAGE(A1, A3, A5, B1:B6)"],
            doc: "Returns the arithmetic mean of all values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Number(
                    util::sum(&args.inner)? / util::count(&args.inner) as f64,
                ))
            }),
        },
        FormulaFunction {
            name: "AVERAGEIF",
            arg_completion: "${1:range_to_evaluate}, ${2:criteria}${3:, ${4:[range_to_average]}}",
            usages: &["range_to_evaluate, criteria, [range_to_average]"],
            examples: &[
                "AVERAGEIF(A1:A10, \"2\")",
                "AVERAGEIF(A1:A10, \">0\")",
                "AVERAGEIF(A1:A10, \"<>INVALID\", B1:B10)",
            ],
            doc: concat!(
                "Evaluates each value based on some criteria, and then computes \
                 the arithmetic mean of the ones that meet those criteria. If \
                 `range_to_average` is given, then values in `range_to_average` \
                 are averaged instead wherever the corresponding value in \
                 `range_to_evaluate` meets the criteria.",
                see_docs_for_more_about_criteria!(),
            ),
            eval: util::pure_fn(|args| {
                let [eval_range, criteria, sum_range] = match args.inner.as_slice() {
                    [range, criteria] => [range, criteria, range],
                    [eval_range, criteria, sum_range] => [eval_range, criteria, sum_range],
                    _ => return Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span)),
                };
                let mut sum = 0.0;
                let mut total = 0;
                for value in util::iter_values_meeting_criteria(eval_range, criteria, sum_range)? {
                    sum += value?.to_number()?;
                    total += 1;
                }
                Ok(Value::Number(sum / total as f64))
            }),
        },
        FormulaFunction {
            name: "COUNT",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["COUNT(A1:C42, E17)", "SUM(A1:A10) / COUNT(A1:A10)"],
            doc: "Returns the number of nonempty values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::count(&args.inner) as f64))),
        },
        FormulaFunction {
            name: "COUNTIF",
            arg_completion: "${1:range_to_evaluate}, ${2:criteria}",
            usages: &["range_to_evaluate, criteria"],
            examples: &[
                "COUNTIF(A1:A10, \"2\")",
                "COUNTIF(A1:A10, \">0\")",
                "COUNTIF(A1:A10, \"<>INVALID\")",
            ],
            doc: concat!(
                "Evaluates each value based on some criteria, and then counts \
                 how many values meet those criteria.",
                see_docs_for_more_about_criteria!(),
            ),
            eval: util::pure_fn(|args| {
                let [range, criteria] = match args.inner.as_slice() {
                    [range, criteria] => [range, criteria],
                    _ => return Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span)),
                };
                // Use `.map_ok().sum()` instead of just `.count()` because we
                // want to propogate errors.
                Ok(Value::Number(
                    util::iter_values_meeting_criteria(range, criteria, range)?
                        .map_ok(|_| 1.0)
                        .sum::<FormulaResult<f64>>()?,
                ))
            }),
        },
        FormulaFunction {
            name: "MIN",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["MIN(A1:A6)", "MIN(0, A1:A6)"],
            doc: "Returns the smallest value.\nReturns +∞ if given no values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Number(
                    util::flat_iter_numbers(&args.inner).try_fold(f64::INFINITY, |ret, next| {
                        FormulaResult::Ok(f64::min(ret, next?))
                    })?,
                ))
            }),
        },
        FormulaFunction {
            name: "MAX",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["MAX(A1:A6)", "MAX(0, A1:A6)"],
            doc: "Returns the largest value.\nReturns -∞ if given no values.",
            eval: util::pure_fn(|args| {
                Ok(Value::Number(
                    util::flat_iter_numbers(&args.inner)
                        .try_fold(-f64::INFINITY, |ret, next| {
                            FormulaResult::Ok(f64::max(ret, next?))
                        })?,
                ))
            }),
        },
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_formula_average() {
        let form = parse_formula("AVERAGE(3, B1:D3)", pos![nAn1]).unwrap();

        let mut g = FnGrid(|pos| {
            if (1..=3).contains(&pos.x) && (1..=3).contains(&pos.y) {
                Some((pos.x * 3 + pos.y).to_string()) // 4 .. 12
            } else {
                panic!("cell {pos} shouldn't be accessed")
            }
        });

        assert_eq!(
            "7.5".to_string(),
            form.eval_blocking(&mut g, pos![nAn1]).unwrap().to_string(),
        );

        assert_eq!(
            "17",
            eval_to_string(&mut g, "AVERAGE(\"\", \"a\", 12, -3.5, 42.5)"),
        );
        assert_eq!("5.5", eval_to_string(&mut g, "AVERAGE(1..10)"));
        assert_eq!("5", eval_to_string(&mut g, "AVERAGE(0..10)"));
    }

    #[test]
    fn test_count() {
        let g = &mut NoGrid;
        assert_eq!("0", eval_to_string(g, "COUNT()"));
        assert_eq!("3", eval_to_string(g, "COUNT(\"\", \"a\", 12, -3.5, 42.5)"));
        assert_eq!("10", eval_to_string(g, "COUNT(1..10)"));
        assert_eq!("11", eval_to_string(g, "COUNT(0..10)"));
    }

    #[test]
    fn test_countif() {
        let g = &mut NoGrid;
        assert_eq!("6", eval_to_string(g, "COUNTIF(0..10, \"<=5\")"));
    }

    #[test]
    fn test_averageif() {
        let g = &mut NoGrid;
        assert_eq!("2.5", eval_to_string(g, "AVERAGEIF(0..10, \"<=5\")"));
    }
}
