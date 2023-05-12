use super::*;

macro_rules! see_docs_for_more_about_criteria {
    () => { " See [the documentation](https://docs.quadratichq.com/formulas) for more details about how criteria work in formulas." };
}

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
            eval: util::pure_fn(|args| Ok(Value::Number(util::sum(&args.inner)?))),
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
            eval: util::pure_fn(|args| match args.inner.as_slice() {
                [range, criteria] => sum_if(range, criteria, range),
                [eval_range, criteria, sum_range] => sum_if(eval_range, criteria, sum_range),
                _ => Err(FormulaErrorMsg::BadArgumentCount.with_span(args.span)),
            }),
        },
        FormulaFunction {
            name: "PRODUCT",
            arg_completion: "${1:a, b, ...}",
            usages: &["a, b, ..."],
            examples: &["PRODUCT(B2:C6, 0.002, E1)"],
            doc: "Multiplies all values.\nReturns 1 if given no values.",
            eval: util::pure_fn(|args| Ok(Value::Number(util::product(&args.inner)?))),
        },
    ]
}

fn sum_if(
    eval_range: &Spanned<Value>,
    criteria: &Spanned<Value>,
    sum_range: &Spanned<Value>,
) -> FormulaResult<Value> {
    use super::super::criteria::Criterion;

    let criteria: Criterion = Criterion::try_from(criteria)?;

    let eval_array_size = eval_range.inner.array_size().unwrap_or((1, 1));
    if let Some(sum_array_size) = sum_range.inner.array_size() {
        if eval_array_size != sum_array_size {
            return Err(FormulaErrorMsg::ArraySizeMismatch {
                expected: eval_array_size,
                got: sum_array_size,
            }
            .with_span(sum_range.span));
        }
    }
    let (rows, cols) = eval_array_size;

    let mut sum = 0.0;

    for col in 0..cols {
        for row in 0..rows {
            if criteria.matches(&eval_range.get_array_value(row, col)?.inner) {
                if let Ok(x) = sum_range.get_array_value(row, col)?.to_number() {
                    sum += x;
                }
            }
        }
    }

    Ok(Value::Number(sum))
}
