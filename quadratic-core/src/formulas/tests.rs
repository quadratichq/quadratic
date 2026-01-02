use std::str::FromStr;

use itertools::Itertools;
use rust_decimal::prelude::*;

pub(crate) use super::*;
use crate::a1::{CellRefCoord, CellRefRange, SheetCellRefRange};
use crate::controller::GridController;
pub(crate) use crate::grid::Grid;
pub(crate) use crate::values::*;
pub(crate) use crate::{CodeResult, RunError, RunErrorMsg, Spanned, array};
use crate::{CoerceInto, Pos, SheetPos};

#[track_caller]
pub(crate) fn try_check_syntax(grid_controller: &GridController, s: &str) -> CodeResult<()> {
    println!("Checking syntax of formula {s:?}");
    let mut ctx = Ctx::new_for_syntax_check(grid_controller);
    simple_parse_formula(s)?
        .eval(&mut ctx)
        .into_non_error_value()
        .map(|_| ())
}

#[track_caller]
pub(crate) fn eval_at(grid_controller: &GridController, pos: SheetPos, s: &str) -> Value {
    println!("Evaluating formula {s:?}");
    let mut ctx = Ctx::new(grid_controller, pos);
    match parse_formula(
        s,
        grid_controller.a1_context(),
        grid_controller.grid().origin_in_first_sheet(),
    ) {
        Ok(formula) => formula.eval(&mut ctx).inner,
        Err(e) => e.into(),
    }
}
#[track_caller]
pub(crate) fn eval(grid_controller: &GridController, s: &str) -> Value {
    eval_at(
        grid_controller,
        Pos::ORIGIN.to_sheet_pos(grid_controller.grid().sheets()[0].id),
        s,
    )
}
#[track_caller]
pub(crate) fn eval_to_string_at(
    grid_controller: &GridController,
    sheet_pos: SheetPos,
    s: &str,
) -> String {
    eval_at(grid_controller, sheet_pos, s).to_string()
}
#[track_caller]
pub(crate) fn eval_to_string(grid_controller: &GridController, s: &str) -> String {
    eval(grid_controller, s).to_string()
}

#[track_caller]
pub(crate) fn eval_to_err(grid_controller: &GridController, s: &str) -> RunError {
    eval(grid_controller, s).unwrap_err()
}

#[track_caller]
pub(crate) fn expect_val(value: impl Into<Value>, ctx: &GridController, s: &str) {
    assert_eq!(value.into(), eval(ctx, s));
}
#[track_caller]
pub(crate) fn expect_err(error_msg: &RunErrorMsg, ctx: &GridController, s: &str) {
    assert_eq!(*error_msg, eval_to_err(ctx, s).msg);
}

#[track_caller]
pub(crate) fn assert_check_syntax_succeeds(grid: &GridController, s: &str) {
    try_check_syntax(grid, s).expect("error with formula syntax");
}
#[track_caller]
pub(crate) fn check_syntax_to_err(grid: &GridController, s: &str) -> RunError {
    try_check_syntax(grid, s).expect_err("expected error")
}

#[track_caller]
pub(crate) fn assert_f64_eval(grid: &GridController, expected: f64, s: &str) {
    let output = eval(grid, s).into_cell_value().unwrap();
    let CellValue::Number(n) = output else {
        panic!("expected number; got {output}");
    };
    crate::util::assert_f64_approx_eq(
        expected,
        n.to_f64().unwrap(),
        &format!("wrong result for formula {s:?}"),
    );
}

/// Parses a date from a string such as `2024-12-31`.
#[track_caller]
pub(crate) fn date(s: &str) -> CellValue {
    CellValue::from(chrono::NaiveDate::from_str(s).unwrap())
}
/// Parses a time from a string such as `16:30:00`.
#[track_caller]
pub(crate) fn time(s: &str) -> CellValue {
    CellValue::from(chrono::NaiveTime::from_str(s).unwrap())
}
/// Parses a datetime from a string such as `2024-12-31T16:30:00`.
#[track_caller]
pub(crate) fn datetime(s: &str) -> CellValue {
    CellValue::from(chrono::NaiveDateTime::from_str(s).unwrap())
}

#[test]
fn test_formula_cell_ref() {
    let mut g = GridController::new();
    let sheet_id = g.sheet_ids()[0];
    g.set_cell_value(pos![sheet_id!B1], "1".into(), None, false);
    g.set_cell_value(pos![sheet_id!B2], "10".into(), None, false);
    g.set_cell_value(pos![sheet_id!B3], "100".into(), None, false);
    g.set_cell_value(pos![sheet_id!B4], "1000".into(), None, false);
    g.set_cell_value(pos![sheet_id!B5], "10000".into(), None, false);

    assert_eq!("11111".to_string(), eval_to_string(&g, "SUM(B1:B5)"));
    assert_eq!("11111".to_string(), eval_to_string(&g, "SUM(B:B)"));
    assert_eq!(
        "{1; 10; 100; 1000; 10000}".to_string(),
        eval_to_string(&g, "B:B"),
    );
}

#[test]
fn test_formula_circular_array_ref() {
    let g = GridController::new();
    let sheet_id = g.sheet_ids()[0];
    let pos = pos![B3].to_sheet_pos(sheet_id);
    let form = parse_formula("$B$1:$C$4", g.a1_context(), pos).unwrap();
    let mut ctx = Ctx::new(&g, pos);
    assert_eq!(
        RunErrorMsg::CircularReference,
        form.eval(&mut ctx).inner.cell_values_slice().unwrap()[4]
            .clone()
            .unwrap_err()
            .msg,
    );
}

#[test]
fn test_formula_range_operator() {
    let expected = "{1; 2; 3; 4; 5}";
    let all_a = ["1", "1.0", ".9"];
    let all_ops = ["..", " ..", " .. ", ".. "];
    let all_b = ["5", "5.0", "5."];
    for (a, op, b) in itertools::iproduct!(all_a, all_ops, all_b) {
        let actual = eval_to_string(&GridController::new(), &format!("{a}{op}{b}"));
        assert_eq!(expected, actual);
    }

    assert_eq!(
        RunErrorMsg::Unexpected("ellipsis".into()),
        simple_parse_formula("1...5").unwrap_err().msg,
    );
}

#[test]
fn test_formula_blank_array_parsing() {
    let g = GridController::new();
    const B: CellValue = CellValue::Blank;
    assert_eq!(Value::from(array![B]), eval(&g, "{}"));
    assert_eq!(Value::from(array![B; B]), eval(&g, "{;}"));
    assert_eq!(Value::from(array![B, B]), eval(&g, "{,}"));
    assert_eq!(Value::from(array![B, B; B, B]), eval(&g, "{,;,}"));
    assert_eq!(
        RunErrorMsg::NonRectangularArray,
        eval_to_err(&g, "{;,;}").msg,
    );
}

#[test]
fn test_formula_array_op() {
    let mut g = GridController::new();
    let sheet_id = g.sheet_ids()[0];
    for x in 1..=4 {
        for y in 1..=4 {
            g.set_cell_value(pos![sheet_id!x,y], (x * 10 + y).to_string(), None, false);
        }
    }

    // Array of values from above:
    // [
    //     [11, 21, 31, 41],
    //     [12, 22, 32, 42],
    //     [13, 23, 33, 43],
    //     [14, 24, 34, 44]
    // ]

    assert_eq!((11 * 31).to_string(), eval_to_string(&g, "A1 * C1"));
    assert_eq!(
        Value::from(array![
            11 * 31, 21 * 31;
            12 * 31, 22 * 31;
            13 * 31, 23 * 31;
            14 * 31, 24 * 31;
        ]),
        eval(&g, "A1:B4 * C1"),
    );
    assert_eq!(
        Value::from(array![
            11 * 31, 11 * 41;
            11 * 32, 11 * 42;
            11 * 33, 11 * 43;
            11 * 34, 11 * 44;
        ]),
        eval(&g, "A1 * C1:D4"),
    );
    assert_eq!(
        Value::from(array![
            11 * 31, 21 * 41;
            12 * 32, 22 * 42;
            13 * 33, 23 * 43;
            14 * 34, 24 * 44;
        ]),
        eval(&g, "A1:B4 * C1:D4"),
    );
    assert_eq!(
        "Array height mismatch: expected value with 1 row or 4 rows, got 5 rows",
        eval_to_err(&g, "A1:B4 * C1:D5").msg.to_string(),
    );
}

#[test]
fn test_array_parsing() {
    let g = GridController::new();

    assert_eq!(
        Value::from(array![
            11, 12;
            21, 22;
            31, 32;
        ]),
        eval(&g, "{11, 12; 21, 22; 31, 32}"),
    );

    // Test stringification
    assert_eq!(
        "{11, 12; 21, 22; 31, 32}",
        eval_to_string(&g, "{11,   12 ;21, 22;31,32}"),
    );

    // Single row
    assert_eq!("{11, 12, 13}", eval_to_string(&g, "{11, 12, 13}"),);

    // Single column
    assert_eq!("{11; 12; 13}", eval_to_string(&g, "{11; 12; 13}"),);

    // Mismatched rows
    assert_eq!(
        RunErrorMsg::NonRectangularArray,
        eval_to_err(&g, "{1; 3, 4}").msg,
    );

    // Blank values
    assert_eq!("{}", eval_to_string(&g, "{}"));
    assert_eq!("{}", eval_to_string(&g, "{ }"));

    // Empty row
    assert_eq!("{; }", eval_to_string(&g, "{ ; }"));
}

#[test]
fn test_bool_parsing() {
    let g = GridController::new();

    assert_eq!("1", eval_to_string(&g, "IF(TRUE, 1, 2)"));
    assert_eq!("1", eval_to_string(&g, "IF(true(), 1, 2)"));
    assert_eq!("2", eval_to_string(&g, "IF(False, 1, 2)"));
    assert_eq!("2", eval_to_string(&g, "IF(FALSE(), 1, 2)"));
}

#[test]
fn test_leading_equals() {
    let g = GridController::new();
    assert_eq!("7", eval_to_string(&g, "=3+4"));
    assert_eq!("7", eval_to_string(&g, "= 3+4"));
}

/// Regression test for quadratic#253
#[test]
fn test_hyphen_after_cell_ref() {
    let mut g = GridController::new();
    let sheet_id = g.sheet_ids()[0];
    g.set_cell_value(pos![sheet_id!Z1], "30".into(), None, false);
    assert_eq!("25", eval_to_string(&g, "Z1 - 5"));
    assert_eq!("25", eval_to_string(&g, "Z1-5"));
}

#[test]
fn test_formula_omit_required_argument() {
    let g = GridController::new();
    assert!(eval_to_string(&g, "ATAN2(,1)").starts_with("1.57"));
    assert_eq!("0", eval_to_string(&g, "ATAN2(1,)"));
    assert_eq!(RunErrorMsg::DivideByZero, eval_to_err(&g, "ATAN2(,)").msg,);
    assert_eq!(
        RunErrorMsg::MissingRequiredArgument {
            func_name: "ATAN2".into(),
            arg_name: "x".into(),
        },
        eval_to_err(&g, "ATAN2()").msg,
    );
    assert_eq!(
        RunErrorMsg::MissingRequiredArgument {
            func_name: "ATAN2".into(),
            arg_name: "y".into(),
        },
        eval_to_err(&g, "ATAN2(1)").msg,
    );
}

#[test]
fn test_formula_blank_to_string() {
    let g = GridController::new();
    assert_eq!("", eval_to_string(&g, "IF(1=1,,)"));
}

#[test]
fn test_find_cell_references() {
    let mut g = GridController::new();
    let sheet1 = g.sheet_ids()[0];

    g.add_sheet(None, None, None, false);
    g.add_sheet(None, None, None, false);
    g.add_sheet(None, None, None, false);
    g.add_sheet(None, None, None, false);
    let apple = g.sheet_ids()[1];
    g.set_sheet_name(apple, "apple".into(), None, false);
    let orange = g.sheet_ids()[2];
    g.set_sheet_name(orange, "orange".into(), None, false);
    let banana = g.sheet_ids()[3];
    g.set_sheet_name(banana, "banana".into(), None, false);
    let plum = g.sheet_ids()[4];
    g.set_sheet_name(plum, "plum".into(), None, false);

    let a = CellRefCoord::new_abs;
    let r = CellRefCoord::new_rel;
    let new_ref = |sheet_id, x1, y1, x2, y2, explicit_sheet_name| {
        Ok(SheetCellRefRange {
            sheet_id,
            cells: CellRefRange::new_sheet_ref(x1, y1, x2, y2),
            explicit_sheet_name,
        })
    };

    // Another test checks that `parse_a1()` is correct.
    let test_cases = [
        // Basic cell reference
        ("$A$1", new_ref(sheet1, a(1), a(1), a(1), a(1), false)),
        // Range
        ("A1:A3", new_ref(sheet1, r(1), r(1), r(1), r(3), false)),
        // Range with spaces
        ("A$2 : B2", new_ref(sheet1, r(1), a(2), r(2), r(2), false)),
        // Unquoted sheet reference
        ("apple!A$1", new_ref(apple, r(1), a(1), r(1), a(1), true)),
        // Unquoted sheet reference range with spaces
        (
            "orange ! A2: $Q9",
            new_ref(orange, r(1), r(2), a(17), r(9), true),
        ),
        // Quoted sheet reference range
        (
            "'banana'!$A1:QQ$222",
            new_ref(banana, a(1), r(1), r(459), a(222), true),
        ),
        // Quoted sheet reference with spaces
        (
            "\"plum\" ! $A1",
            new_ref(plum, a(1), r(1), a(1), r(1), true),
        ),
    ];
    let formula_string = test_cases.iter().map(|(string, _)| string).join(" + ");
    let pos = Pos::ORIGIN.to_sheet_pos(sheet1);
    let cell_references_found = find_cell_references(&formula_string, g.a1_context(), pos)
        .into_iter()
        .map(|Spanned { span, inner }| (span.of_str(&formula_string), inner))
        .collect_vec();
    // Assert each individual one for better error messages on test failure.
    for i in 0..test_cases.len() {
        assert_eq!(&test_cases[i], &cell_references_found[i]);
    }
    assert_eq!(test_cases.len(), cell_references_found.len());
}

#[test]
fn test_sheet_references() {
    let mut g = GridController::new();

    let id1 = g.sheet_ids()[0];
    let name1 = "MySheet".to_string();
    g.set_sheet_name(id1, name1.clone(), None, false);

    g.add_sheet(None, None, None, false);
    let id2 = g.sheet_ids()[1];
    let name2 = "My Other Sheet".to_string();
    g.set_sheet_name(id2, name2.clone(), None, false);

    g.set_cell_value(pos![id1!A1], "42".into(), None, false);
    g.set_cell_value(pos![id1!A3], "6".into(), None, false);
    g.set_cell_value(pos![id2!A3], "7".into(), None, false);
    g.set_cell_value(pos![id2!A4], "70".into(), None, false);

    let pos1 = Pos::ORIGIN.to_sheet_pos(id1);
    let pos2 = Pos::ORIGIN.to_sheet_pos(id2);

    assert_eq!("426", eval_to_string_at(&g, pos1, "MySheet!A1 & A3"));
    assert_eq!("427", eval_to_string_at(&g, pos2, "MySheet!A1 & A3"));

    assert_eq!(
        "76",
        eval_to_string_at(&g, pos1, "'My Other Sheet'!A3 & A3"),
    );
    assert_eq!(
        "77",
        eval_to_string_at(&g, pos2, "\"My Other Sheet\"!A3 & A3"),
    );
    assert_eq!(
        "{76; 706}",
        eval_to_string_at(&g, pos1, "\"My Other Sheet\"!A3:A4 & A3"),
    );
}

#[test]
fn test_table_references() {
    let (gc, _sheet_id, _pos, _file_name) =
        crate::controller::user_actions::import::tests::simple_csv();

    for (formula, expected) in [
        (
            "simple.csv",
            "{Southborough, MA, United States, 9686; Northbridge, MA, United States, 14061; Westborough, MA, United States, 29313; Marlborough, MA, United States, 38334; Springfield, MA, United States, 152227; Springfield, MO, United States, 150443; Springfield, NJ, United States, 14976; Springfield, OH, United States, 64325; Springfield, OR, United States, 56032; Concord, NH, United States, 42605}",
        ),
        (
            "simple.csv[#HEADERS]",
            "{city, region, country, population}",
        ),
        (
            "simple.csv[[#HEADERS]]",
            "{city, region, country, population}",
        ),
        (
            "simple.csv[region]",
            "{MA; MA; MA; MA; MA; MO; NJ; OH; OR; NH}",
        ),
        (
            "simple.csv[[region]]",
            "{MA; MA; MA; MA; MA; MO; NJ; OH; OR; NH}",
        ),
        (
            "simple.csv[[city]:[country]]",
            "{Southborough, MA, United States; Northbridge, MA, United States; Westborough, MA, United States; Marlborough, MA, United States; Springfield, MA, United States; Springfield, MO, United States; Springfield, NJ, United States; Springfield, OH, United States; Springfield, OR, United States; Concord, NH, United States}",
        ),
        (
            "simple.csv[[#dAtA], [city]:[country]]",
            "{Southborough, MA, United States; Northbridge, MA, United States; Westborough, MA, United States; Marlborough, MA, United States; Springfield, MA, United States; Springfield, MO, United States; Springfield, NJ, United States; Springfield, OH, United States; Springfield, OR, United States; Concord, NH, United States}",
        ),
        (
            "simple.csv[[#headers], [city]:[country]]",
            "{city, region, country}",
        ),
        (
            "simple.csv[ [#Headers],[#Data], [city]:[country]]",
            "{city, region, country; Southborough, MA, United States; Northbridge, MA, United States; Westborough, MA, United States; Marlborough, MA, United States; Springfield, MA, United States; Springfield, MO, United States; Springfield, NJ, United States; Springfield, OH, United States; Springfield, OR, United States; Concord, NH, United States}",
        ),
        (
            "simple.csv[[#aLL],  [city]:[country]  ]",
            "{city, region, country; Southborough, MA, United States; Northbridge, MA, United States; Westborough, MA, United States; Marlborough, MA, United States; Springfield, MA, United States; Springfield, MO, United States; Springfield, NJ, United States; Springfield, OH, United States; Springfield, OR, United States; Concord, NH, United States}",
        ),
        (
            "simple.csv[[#All], [country]:]",
            "{country, population; United States, 9686; United States, 14061; United States, 29313; United States, 38334; United States, 152227; United States, 150443; United States, 14976; United States, 64325; United States, 56032; United States, 42605}",
        ),
    ] {
        assert_eq!(expected, eval_to_string(&gc, formula));
    }
}

#[test]
fn test_cell_range_op_errors() {
    let g = GridController::new();

    eval_to_string(&g, "A1:B5"); // assert ok
    assert_check_syntax_succeeds(&g, "A1:B5"); // assert ok

    for (expected, formula_str) in [
        ("comparison", "A1:(1==2)"),
        ("expression", "A1:(1+5)"), // error message could be improved
        ("function call", "A1:SUM(1, 2, 3)"),
        ("array literal", "A1:{1, 2, 3}"),
        ("array literal", "A1:{1, 2, 3}"),
        ("string literal", "A1:\"hello\""),
        // ("numeric literal", "A1:12"),
        ("boolean literal", "A1:TRUE"),
    ] {
        let expected_err = RunErrorMsg::Expected {
            expected: "cell reference".into(),
            got: Some(expected.into()),
        };
        assert_eq!(expected_err, eval_to_err(&g, formula_str).msg);
        assert_eq!(expected_err, check_syntax_to_err(&g, formula_str).msg);
    }
}

#[test]
fn test_formula_error_literals() {
    let g = GridController::new();

    assert_eq!(RunErrorMsg::DivideByZero, eval_to_err(&g, "#DIV/0!").msg);
    assert_eq!(RunErrorMsg::NotAvailable, eval_to_err(&g, "#N/A").msg);
    assert_eq!(RunErrorMsg::Name, eval_to_err(&g, "#NAME?").msg);
    assert_eq!(RunErrorMsg::Null, eval_to_err(&g, "#NULL!").msg);
    assert_eq!(RunErrorMsg::Num, eval_to_err(&g, "#NUM!").msg);
    assert_eq!(RunErrorMsg::BadCellReference, eval_to_err(&g, "#REF!").msg);
    assert_eq!(RunErrorMsg::Value, eval_to_err(&g, "#VALUE!").msg);

    assert_eq!(
        RunErrorMsg::Value,
        eval_to_err(&g, "IF(FALSE, 'meow', #VALUE!)").msg,
    );
    assert_eq!("meow", eval_to_string(&g, "IF(TRUE, 'meow', #VALUE!)"));
}

/// Regression test for quadratic#410
#[test]
fn test_currency_string() {
    let g = GridController::new();
    assert_eq!("30", eval_to_string(&g, "\"$10\" + 20"));
}

#[test]
fn test_syntax_check_ok() {
    let g = GridController::new();
    assert_check_syntax_succeeds(&g, "1+1");
    assert_check_syntax_succeeds(&g, "1/0");
    assert_check_syntax_succeeds(&g, "SUM(1, 2, 3)");
    assert_check_syntax_succeeds(&g, "{1, 2, 3}");
    assert_check_syntax_succeeds(&g, "{1, 2; 3, 4}");
    assert_check_syntax_succeeds(&g, "XLOOKUP(\"zebra\", A1:Z1, A4:Z6)");
    assert_check_syntax_succeeds(&g, "ABS(({1, 2; 3, 4}, A1:C10))");
}

// ============================================================================
// LAMBDA tests
// ============================================================================

#[test]
fn test_lambda_basic_invocation() {
    let g = GridController::new();

    // Basic lambda invocation: LAMBDA(x, x+1)(5) = 6
    assert_eq!("6", eval_to_string(&g, "LAMBDA(x, x+1)(5)"));

    // Lambda with multiple parameters
    assert_eq!("15", eval_to_string(&g, "LAMBDA(a, b, a+b)(5, 10)"));

    // Lambda with multiplication
    assert_eq!("50", eval_to_string(&g, "LAMBDA(x, y, x*y)(5, 10)"));

    // Lambda that returns a constant
    assert_eq!("42", eval_to_string(&g, "LAMBDA(x, 42)(999)"));

    // Lambda with no parameters (just a body)
    assert_eq!("100", eval_to_string(&g, "LAMBDA(100)()"));
}

#[test]
fn test_lambda_celsius_to_fahrenheit() {
    let g = GridController::new();

    // Classic example: Celsius to Fahrenheit
    // F = C * 9/5 + 32
    // 0°C = 32°F
    assert_eq!("32", eval_to_string(&g, "LAMBDA(c, c*9/5+32)(0)"));
    // 100°C = 212°F
    assert_eq!("212", eval_to_string(&g, "LAMBDA(c, c*9/5+32)(100)"));
    // 25°C = 77°F
    assert_eq!("77", eval_to_string(&g, "LAMBDA(c, c*9/5+32)(25)"));
}

#[test]
fn test_lambda_with_formula_functions() {
    let g = GridController::new();

    // Lambda that uses built-in functions
    assert_eq!("5", eval_to_string(&g, "LAMBDA(x, ABS(x))(-5)"));
    assert_eq!("10", eval_to_string(&g, "LAMBDA(a, b, MAX(a, b))(5, 10)"));
    assert_eq!("3", eval_to_string(&g, "LAMBDA(x, SQRT(x))(9)"));
}

#[test]
fn test_lambda_nested_expression() {
    let g = GridController::new();

    // Complex nested expression
    // (4 + 3) * (4 - 3) + 16 = 7 * 1 + 16 = 23
    assert_eq!(
        "23",
        eval_to_string(&g, "LAMBDA(x, (x + 3) * (x - 3) + 16)(4)")
    );

    // Lambda with conditional
    assert_eq!(
        "positive",
        eval_to_string(&g, "LAMBDA(x, IF(x > 0, \"positive\", \"negative\"))(5)")
    );
    assert_eq!(
        "negative",
        eval_to_string(&g, "LAMBDA(x, IF(x > 0, \"positive\", \"negative\"))(-5)")
    );
}

#[test]
fn test_lambda_case_insensitive() {
    let g = GridController::new();

    // LAMBDA is case-insensitive
    assert_eq!("6", eval_to_string(&g, "lambda(x, x+1)(5)"));
    assert_eq!("6", eval_to_string(&g, "Lambda(x, x+1)(5)"));
    assert_eq!("6", eval_to_string(&g, "LAMBDA(x, x+1)(5)"));
}

#[test]
fn test_lambda_parameter_case_insensitive() {
    let g = GridController::new();

    // Parameters should work case-insensitively
    // When we use 'x' as a parameter, it's stored as 'X'
    // When the body references 'x', it's looked up as 'X'
    assert_eq!("6", eval_to_string(&g, "LAMBDA(X, X+1)(5)"));
    assert_eq!("6", eval_to_string(&g, "LAMBDA(x, X+1)(5)"));
}

#[test]
fn test_lambda_shadowing() {
    let mut g = GridController::new();
    let sheet_id = g.sheet_ids()[0];

    // Set X1 to 100 (column X, row 1)
    g.set_cell_value(pos![sheet_id!X1], "100".into(), None, false);

    // Without LAMBDA, X1 returns a 1x1 array containing 100
    assert_eq!("{100}", eval_to_string(&g, "X1"));

    // With LAMBDA, x parameter should shadow the column reference
    // When we use x in the lambda body, it refers to the parameter, not column X
    assert_eq!("6", eval_to_string(&g, "LAMBDA(x, x+1)(5)"));

    // If the body uses a full cell reference like X1, it should still work
    // Note: X1 returns a 1x1 array, so the result is also an array
    assert_eq!("101", eval_to_string(&g, "LAMBDA(y, SUM(X1)+1)(5)"));
}

#[test]
fn test_lambda_errors() {
    let g = GridController::new();

    // Missing body - LAMBDA with no arguments
    assert_eq!(
        RunErrorMsg::MissingRequiredArgument {
            func_name: "LAMBDA".into(),
            arg_name: "body".into(),
        },
        eval_to_err(&g, "LAMBDA()").msg
    );

    // Wrong number of arguments when calling lambda
    assert_eq!(
        RunErrorMsg::TooManyArguments {
            func_name: "LAMBDA".into(),
            max_arg_count: 1,
        },
        eval_to_err(&g, "LAMBDA(x, x+1)(5, 10)").msg
    );

    // Calling a non-lambda value
    assert!(matches!(
        eval_to_err(&g, "(5)(10)").msg,
        RunErrorMsg::Expected { expected, .. } if expected == "lambda"
    ));
}
