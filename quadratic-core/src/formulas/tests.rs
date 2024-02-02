use itertools::Itertools;

pub(crate) use super::*;
pub(crate) use crate::grid::Grid;
pub(crate) use crate::values::*;
pub(crate) use crate::{array, CodeResult, RunError, RunErrorMsg, Spanned};
use crate::{Pos, SheetPos};

pub(crate) fn try_eval_at(grid: &Grid, pos: SheetPos, s: &str) -> CodeResult<Value> {
    println!("Evaluating formula {s:?} at {pos:?}");
    let mut ctx = Ctx::new(grid, pos);
    parse_formula(s, Pos::ORIGIN)?.eval(&mut ctx)
}
#[track_caller]
pub(crate) fn eval_at(grid: &Grid, sheet_pos: SheetPos, s: &str) -> Value {
    try_eval_at(grid, sheet_pos, s).expect("error evaluating formula")
}
#[track_caller]
pub(crate) fn eval_to_string_at(grid: &Grid, sheet_pos: SheetPos, s: &str) -> String {
    eval_at(grid, sheet_pos, s).to_string()
}

pub(crate) fn try_eval(grid: &Grid, s: &str) -> CodeResult<Value> {
    try_eval_at(grid, Pos::ORIGIN.to_sheet_pos(grid.sheets()[0].id), s)
}
#[track_caller]
pub(crate) fn eval(grid: &Grid, s: &str) -> Value {
    try_eval(grid, s).expect("error evaluating formula")
}
#[track_caller]
pub(crate) fn eval_to_string(grid: &Grid, s: &str) -> String {
    eval(grid, s).to_string()
}
#[track_caller]
pub(crate) fn eval_to_err(grid: &Grid, s: &str) -> RunError {
    try_eval(grid, s).expect_err("expected error")
}

#[track_caller]
pub(crate) fn expect_val(value: impl Into<Value>, ctx: &Grid, s: &str) {
    assert_eq!(value.into(), eval(ctx, s));
}
#[track_caller]
pub(crate) fn expect_err(error_msg: &RunErrorMsg, ctx: &Grid, s: &str) {
    assert_eq!(*error_msg, eval_to_err(ctx, s).msg);
}

#[test]
fn test_formula_cell_ref() {
    let form = parse_formula("SUM($D$4, $B0, E$n6, B0, nB2)", pos![D4]).unwrap();

    let mut g = Grid::new();
    let sheet = &mut g.sheets_mut()[0];
    let _ = sheet.set_cell_value(pos![D4], 1); // $D$4 -> D4
    let _ = sheet.set_cell_value(pos![Bn2], 10); // $B0  -> Bn2
    let _ = sheet.set_cell_value(pos![Cn6], 100); // E$n6 -> Cn6
    let _ = sheet.set_cell_value(pos![nAn2], 1000); // B0   -> nAn2
    let _ = sheet.set_cell_value(pos![nD0], 10000); // nB2  -> nD0
    let sheet_id = sheet.id;

    // Evaluate at D4, causing a circular reference.
    let mut ctx = Ctx::new(&g, pos![D4].to_sheet_pos(sheet_id));
    assert_eq!(
        RunErrorMsg::CircularReference,
        form.eval(&mut ctx).unwrap_err().msg,
    );

    // Evaluate at B2
    let mut ctx = Ctx::new(&g, pos![B2].to_sheet_pos(sheet_id));
    assert_eq!(
        "11111".to_string(),
        form.eval(&mut ctx).unwrap().to_string(),
    );
}

#[test]
fn test_formula_circular_array_ref() {
    let form = parse_formula("$B$0:$C$4", pos![A0]).unwrap();

    let g = Grid::new();
    let mut ctx = Ctx::new(&g, pos![B2].to_sheet_pos(g.sheets()[0].id));

    assert_eq!(
        RunErrorMsg::CircularReference,
        form.eval(&mut ctx).unwrap_err().msg,
    );
}

#[test]
fn test_formula_range_operator() {
    let expected = "{1; 2; 3; 4; 5}";
    let all_a = ["1", "1.0", ".9"];
    let all_ops = ["..", " ..", " .. ", ".. "];
    let all_b = ["5", "5.0", "5."];
    for (a, op, b) in itertools::iproduct!(all_a, all_ops, all_b) {
        let actual = eval_to_string(&Grid::new(), &format!("{a}{op}{b}"));
        assert_eq!(expected, actual);
    }

    assert_eq!(
        RunErrorMsg::Unexpected("ellipsis".into()),
        parse_formula("1...5", Pos::ORIGIN).unwrap_err().msg,
    );
}

#[test]
fn test_formula_blank_array_parsing() {
    let g = Grid::new();
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
    let mut g = Grid::new();
    let sheet = &mut g.sheets_mut()[0];
    for x in 1..=4 {
        for y in 1..=4 {
            let _ = sheet.set_cell_value(Pos { x, y }, x * 10 + y);
        }
    }

    assert_eq!((11 * 31).to_string(), eval_to_string(&g, "B1 * D1"));
    assert_eq!(
        Value::from(array![
            11 * 31, 21 * 31;
            12 * 31, 22 * 31;
            13 * 31, 23 * 31;
            14 * 31, 24 * 31;
        ]),
        eval(&g, "B1:C4 * D1"),
    );
    assert_eq!(
        Value::from(array![
            11 * 31, 11 * 41;
            11 * 32, 11 * 42;
            11 * 33, 11 * 43;
            11 * 34, 11 * 44;
        ]),
        eval(&g, "B1 * D1:E4"),
    );
    assert_eq!(
        Value::from(array![
            11 * 31, 21 * 41;
            12 * 32, 22 * 42;
            13 * 33, 23 * 43;
            14 * 34, 24 * 44;
        ]),
        eval(&g, "B1:C4 * D1:E4"),
    );
    assert_eq!(
        "Array height mismatch: expected value with 1 row or 4 rows, got 5 rows",
        eval_to_err(&g, "B1:C4 * D1:E5").msg.to_string(),
    );
}

#[test]
fn test_array_parsing() {
    let g = Grid::new();

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
    let g = Grid::new();

    assert_eq!("1", eval_to_string(&g, "IF(TRUE, 1, 2)"));
    assert_eq!("1", eval_to_string(&g, "IF(true(), 1, 2)"));
    assert_eq!("2", eval_to_string(&g, "IF(False, 1, 2)"));
    assert_eq!("2", eval_to_string(&g, "IF(FALSE(), 1, 2)"));
}

#[test]
fn test_leading_equals() {
    let g = Grid::new();
    assert_eq!("7", eval_to_string(&g, "=3+4"));
    assert_eq!("7", eval_to_string(&g, "= 3+4"));
}

/// Regression test for quadratic#253
#[test]
fn test_hyphen_after_cell_ref() {
    let mut g = Grid::new();
    let _ = g.sheets_mut()[0].set_cell_value(pos![Z1], 30);
    assert_eq!("25", eval_to_string(&g, "Z1 - 5"));
    assert_eq!("25", eval_to_string(&g, "Z1-5"));
}

#[test]
fn test_formula_omit_required_argument() {
    let g = Grid::new();
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
    let g = Grid::new();
    assert_eq!("", eval_to_string(&g, "IF(1=1,,)"));
}

#[test]
fn test_find_cell_references() {
    #[track_caller]
    fn a1(s: &str) -> CellRef {
        CellRef::parse_a1(s, Pos::ORIGIN).expect("bad cell reference")
    }

    // Another test checks that `parse_a1()` is correct.
    let test_cases = [
        // Basic cell reference
        ("$A$1", RangeRef::Cell { pos: a1("$A$1") }),
        // Range
        (
            "An1:A3",
            RangeRef::CellRange {
                start: a1("An1"),
                end: a1("A3"),
            },
        ),
        // Range with spaces
        (
            "A$2 : Bn2",
            RangeRef::CellRange {
                start: a1("A$2"),
                end: a1("Bn2"),
            },
        ),
        // Unquoted sheet reference
        (
            "apple!A$1",
            RangeRef::Cell {
                pos: a1("apple!A$1"),
            },
        ),
        // Unquoted sheet reference range with spaces
        (
            "orange ! A2: $Q9",
            RangeRef::CellRange {
                start: a1("orange ! A2"),
                end: a1("$Q9"),
            },
        ),
        // Quoted sheet reference range
        (
            "'banana'!$A1:QQ$222",
            RangeRef::CellRange {
                start: a1("'banana'!$A1"),
                end: a1("QQ$222"),
            },
        ),
        // Quoted sheet reference with spaces
        (
            "\"plum\" ! $A1",
            RangeRef::Cell {
                pos: a1("\"plum\"!$A1"),
            },
        ),
    ];
    let formula_string = test_cases.iter().map(|(string, _)| string).join(" + ");
    let cell_references_found = find_cell_references(&formula_string, Pos::ORIGIN)
        .into_iter()
        .map(|Spanned { span, inner }| (span.of_str(&formula_string), inner))
        .collect_vec();
    // Assert each individual one for better error messages on test failure.
    for i in 0..test_cases.len() {
        assert_eq!(&cell_references_found[i], &test_cases[i]);
    }
    assert_eq!(cell_references_found.len(), test_cases.len());
}

#[test]
fn test_sheet_references() {
    let mut g = Grid::new();

    let id1 = g.sheets()[0].id;
    let name1 = "MySheet".to_string();
    g.sheets_mut()[0].name = name1.clone();

    let id2 = g.add_sheet(None);
    let name2 = "My Other Sheet".to_string();
    g.sheets_mut()[1].name = name2.clone();

    let _ = g.try_sheet_mut(id1).unwrap().set_cell_value(pos![A1], 42);
    let _ = g.try_sheet_mut(id1).unwrap().set_cell_value(pos![A3], 6);
    let _ = g.try_sheet_mut(id2).unwrap().set_cell_value(pos![A3], 7);
    let _ = g.try_sheet_mut(id2).unwrap().set_cell_value(pos![A4], 70);

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

/// Regression test for quadratic#410
#[test]
fn test_currency_string() {
    let g = Grid::new();
    assert_eq!("30", eval_to_string(&g, "\"$10\" + 20"));
}
