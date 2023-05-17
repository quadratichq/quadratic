use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Mathematics functions",
    docs: "",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        FormulaFunction {
            name: "SUM",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["SUM(B2:C6, 15, E1)"],
            doc: "Adds all values.\nReturns `0` if given no values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::sum(&args.inner)))),
        },
        FormulaFunction {
            name: "SUMIF",
            arg_completion: "${1:range_to_evaluate}, ${2:criteria}${3:, ${4:[range_to_sum]}}",
            usages: &["range_to_evaluate, criteria, [range_to_sum]"],
            examples: &[
                "SUMIF(A1:A10, \"2\")",
                "SUMIF(A1:A10, \">0\")",
                "SUMIF(A1:A10, \"<>INVALID\", B1:B10)",
            ],
            doc: concat!(
                "Evaluates each value based on some criteria, and then adds the \
                 ones that meet those criteria. If `range_to_sum` is given, then \
                 values in `range_to_sum` are added instead wherever the corresponding
                 value in `range_to_evaluate` meets the criteria.",
                see_docs_for_more_about_criteria!(),
            ),
            eval: util::pure_fn(|args| {
                let [eval_range, criteria, sum_range] = match args.inner.as_slice() {
                    [range, criteria] => [range, criteria, range],
                    [eval_range, criteria, sum_range] => [eval_range, criteria, sum_range],
                    _ => return Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span)),
                };
                let values = util::iter_values_meeting_criteria(eval_range, criteria, sum_range)?
                    .collect::<FormulaResult<Vec<_>>>()?;
                Ok(Value::Number(util::sum(&values)))
            }),
        },
        FormulaFunction {
            name: "PRODUCT",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["PRODUCT(B2:C6, 0.002, E1)"],
            doc: "Multiplies all values.\nReturns 1 if given no values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::product(&args.inner)))),
        },
    ]
}

#[cfg(test)]
mod tests {
    use crate::formulas::tests::*;

    #[test]
    fn test_sum() {
        let g = &mut NoGrid;
        assert_eq!("0", eval_to_string(g, "SUM(\"\", \"abc\")"));
        assert_eq!("12", eval_to_string(g, "SUM(\"\", \"abc\", 12)"));
        assert_eq!("27", eval_to_string(g, "SUM(0..5, \"\", \"abc\", 12)"));
    }

    #[test]
    fn test_sumif() {
        let g = &mut NoGrid;
        assert_eq!("15", eval_to_string(g, "SUMIF(0..10, \"<=5\")"));
        assert_eq!("63", eval_to_string(g, "SUMIF(0..10, \"<=5\", 2^0..10)"));
    }

    #[test]
    fn test_product() {
        let g = &mut NoGrid;
        assert_eq!("1", eval_to_string(g, "PRODUCT(\"\", \"abc\")"));
        assert_eq!("12", eval_to_string(g, "PRODUCT(\"\", \"abc\", 12)"));
        assert_eq!(
            "1440",
            eval_to_string(g, "PRODUCT(1..5, \"\", \"abc\", 12)")
        );
        assert_eq!("0", eval_to_string(g, "PRODUCT(0..5, \"\", \"abc\", 12)"));
    }
}
