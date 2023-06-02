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
            fn AVERAGE(numbers: (Iter<f64>)) {
                let mut sum = 0.0;
                let mut count = 0;
                for n in numbers {
                    sum += n?;
                    count += 1;
                }
                sum / count as f64
            }
        ),
        formula_fn!(
            /// Returns the number of numeric values.
            #[examples("COUNT(A1:C42, E17)", "SUM(A1:A10) / COUNT(A1:A10)")]
            fn COUNT(numbers: (Iter<f64>)) {
                // Ignore error values.
                numbers.filter(|x| x.is_ok()).count() as f64
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
            eval_to_string(&mut g, "AVERAGE({\"_\", \"a\"}, 12, -3.5, 42.5)"),
        );
        assert_eq!("5.5", eval_to_string(&mut g, "AVERAGE(1..10)"));
        assert_eq!("5", eval_to_string(&mut g, "AVERAGE(0..10)"));
    }

    #[test]
    fn test_count() {
        let g = &mut NoGrid;
        assert_eq!("0", eval_to_string(g, "COUNT()"));
        assert_eq!(
            "3",
            eval_to_string(g, "COUNT(\"_\", \"a\", 12, -3.5, 42.5)"),
        );
        assert_eq!("1", eval_to_string(g, "COUNT(2)"));
        assert_eq!("10", eval_to_string(g, "COUNT(1..10)"));
        assert_eq!("11", eval_to_string(g, "COUNT(0..10)"));
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
