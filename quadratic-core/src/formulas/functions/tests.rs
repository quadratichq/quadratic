#![cfg(test)]

use super::*;
use crate::{formulas::tests::*, grid::Grid};

pub const CATEGORY: FormulaFunctionCategory = FormulaFunctionCategory {
    include_in_docs: true,
    include_in_completions: true,
    name: "Test functions",
    docs: "These functions should not appear in production.\n\n",
    get_functions,
};

fn get_functions() -> Vec<FormulaFunction> {
    vec![
        formula_fn!(
            /// Returns an error if the argument is not a single value.
            #[include_args_in_completion(false)]
            #[examples("_TEST_CELL_VALUE(1)")]
            fn _TEST_CELL_VALUE(value: CellValue) {
                value
            }
        ),
        formula_fn!(
            /// Returns an error if the argument cannot be coerced to an array.
            #[include_args_in_completion(false)]
            #[examples("_TEST_ARRAY(1)")]
            fn _TEST_ARRAY(array: Array) {
                array
            }
        ),
        formula_fn!(
            /// Returns an error if the argument cannot be coerced to an tuple.
            #[include_args_in_completion(false)]
            #[examples("_TEST_TUPLE(1)")]
            fn _TEST_TUPLE(tuple: (Vec<Array>)) {
                tuple.len()
            }
        ),
    ]
}

#[test]
fn test_convert_to_cell_value() {
    let g = Grid::new();

    assert_eq!("3", eval_to_string(&g, "_TEST_CELL_VALUE(3)"));
    assert_eq!("", eval_to_string(&g, "_TEST_CELL_VALUE(A1)"));
    assert_eq!("3", eval_to_string(&g, "_TEST_CELL_VALUE({3})"));
    assert_eq!("", eval_to_string(&g, "_TEST_CELL_VALUE(A1:A1)"));
    assert_eq!(
        RunErrorMsg::Expected {
            expected: "single value".into(),
            got: Some("array".into())
        },
        eval_to_err(&g, "_TEST_CELL_VALUE(A1:A10)").msg,
    );
    assert_eq!(
        RunErrorMsg::Expected {
            expected: "single value".into(),
            got: Some("tuple".into())
        },
        eval_to_err(&g, "_TEST_CELL_VALUE((A1:A10, C1:C10))").msg,
    );
}

#[test]
fn test_convert_to_array() {
    let mut g = Grid::new();

    assert_eq!("{3}", eval_to_string(&g, "_TEST_ARRAY(3)"));
    assert_eq!("{}", eval_to_string(&g, "_TEST_ARRAY(A1)"));
    assert_eq!("{3}", eval_to_string(&g, "_TEST_ARRAY({3})"));
    assert_eq!("{}", eval_to_string(&g, "_TEST_ARRAY(A1:A1)"));
    g.sheets_mut()[0].set_cell_value(pos![A2], 0);
    g.sheets_mut()[0].set_cell_value(pos![A3], 1);
    g.sheets_mut()[0].set_cell_value(pos![A4], -5);
    g.sheets_mut()[0].set_cell_value(pos![A5], "hello");
    // This string format is used for testing and potentially display; not as an
    // unambiguous representation, so it's fine that the string is unquoted.
    assert_eq!(
        "{; 0; 1; -5; hello; ; ; ; ; }",
        eval_to_string(&g, "_TEST_ARRAY(A1:A10)"),
    );
    assert_eq!(
        RunErrorMsg::Expected {
            expected: "array".into(),
            got: Some("tuple".into())
        },
        eval_to_err(&g, "_TEST_ARRAY((A1:A10, C1:C10))").msg,
    );
}

#[test]
fn test_convert_to_tuple() {
    let mut g = Grid::new();

    assert_eq!("1", eval_to_string(&g, "_TEST_TUPLE(3)"));
    assert_eq!("1", eval_to_string(&g, "_TEST_TUPLE(A1)"));
    assert_eq!("1", eval_to_string(&g, "_TEST_TUPLE({3})"));
    assert_eq!("1", eval_to_string(&g, "_TEST_TUPLE(A1:A1)"));
    g.sheets_mut()[0].set_cell_value(pos![A2], 0);
    g.sheets_mut()[0].set_cell_value(pos![A3], 1);
    g.sheets_mut()[0].set_cell_value(pos![A4], -5);
    g.sheets_mut()[0].set_cell_value(pos![A5], "hello");
    // This string format is used for testing and potentially display; not as an
    // unambiguous representation, so it's fine that the string is unquoted.
    assert_eq!("1", eval_to_string(&g, "_TEST_TUPLE(A1:A10)"),);
    assert_eq!("2", eval_to_string(&g, "_TEST_TUPLE((A1:A10, C1:C10))"),);
}
