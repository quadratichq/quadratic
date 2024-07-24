use super::*;

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Logic functions",
    docs: "These functions treat `FALSE` and `0` as \
           \"falsey\" and all other values are \"truthy.\"\
           \n\n\
           When used as a number, `TRUE` is equivalent \
           to `1` and `FALSE` is equivalent to `0`.\
           \n\n",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns `TRUE`.
            #[include_args_in_completion(false)]
            #[examples("TRUE()")]
            fn TRUE() {
                true
            }
        ),
        formula_fn!(
            /// Returns `FALSE`.
            #[include_args_in_completion(false)]
            #[examples("FALSE()")]
            fn FALSE() {
                false
            }
        ),
        formula_fn!(
            /// Returns `TRUE` if `a` is falsey and `FALSE` if `a` is truthy.
            #[examples("NOT(A113)")]
            #[zip_map]
            fn NOT([boolean]: bool) {
                !boolean
            }
        ),
        formula_fn!(
            /// Returns `TRUE` if all values are truthy and `FALSE` if any value
            /// is falsey.
            ///
            /// Returns `TRUE` if given no values.
            #[examples("AND(A1:C1)", "AND(A1, B12)")]
            fn AND(booleans: (Iter<bool>)) {
                booleans.try_fold(true, |a, b| Ok(a & b?))
            }
        ),
        formula_fn!(
            /// Returns `TRUE` if any value is truthy and `FALSE` if all values
            /// are falsey.
            ///
            /// Returns `FALSE` if given no values.
            #[examples("OR(A1:C1)", "OR(A1, B12)")]
            fn OR(booleans: (Iter<bool>)) {
                booleans.try_fold(false, |a, b| Ok(a | b?))
            }
        ),
        formula_fn!(
            /// Returns `TRUE` if an odd number of values are truthy and `FALSE`
            /// if an even number of values are truthy.
            ///
            /// Returns `FALSE` if given no values.
            #[examples("XOR(A1:C1)", "XOR(A1, B12)")]
            fn XOR(booleans: (Iter<bool>)) {
                booleans.try_fold(false, |a, b| Ok(a ^ b?))
            }
        ),
        formula_fn!(
            /// Returns `t` if `condition` is truthy and `f` if `condition` is
            /// falsey.
            #[examples(
                "IF(A2<0, \"A2 is negative\", \"A2 is nonnegative\")",
                "IF(A2<0, \"A2 is negative\", IF(A2>0, \"A2 is positive\", \"A2 is zero\"))"
            )]
            #[zip_map]
            fn IF([condition]: bool, [t]: CellValue, [f]: CellValue) {
                if condition { t } else { f }.clone()
            }
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::{formulas::tests::*, Pos};

    #[test]
    fn test_formula_if() {
        let form = parse_formula("IF(A1='q', 'yep', 'nope')", pos![A0]).unwrap();

        let mut g = Grid::new();
        let sheet = &mut g.sheets_mut()[0];
        let _ = sheet.set_cell_value(Pos { x: 0, y: 1 }, "q");
        let _ = sheet.set_cell_value(Pos { x: 1, y: 1 }, "w");
        let sheet_id = sheet.id;

        let mut ctx = Ctx::new(&g, pos![A0].to_sheet_pos(sheet_id));
        assert_eq!("yep".to_string(), form.eval(&mut ctx).unwrap().to_string());
        let mut ctx = Ctx::new(&g, pos![B0].to_sheet_pos(sheet_id));
        assert_eq!("nope".to_string(), form.eval(&mut ctx).unwrap().to_string());
    }
}
