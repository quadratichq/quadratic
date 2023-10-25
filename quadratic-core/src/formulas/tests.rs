pub(crate) use super::*;
pub(crate) use crate::grid::Grid;
pub(crate) use crate::values::*;
pub(crate) use crate::{array, CodeResult, Error, ErrorMsg, Pos};

pub(crate) fn try_eval(grid: &Grid, s: &str) -> CodeResult<Value> {
    println!("Evaluating formula {s:?}");
    let mut ctx = Ctx::new(grid, Pos::ORIGIN.with_sheet(grid.sheets()[0].id));
    parse_formula(s, Pos::ORIGIN)?.eval(&mut ctx)
}
#[track_caller]
pub(crate) fn eval(ctx: &Grid, s: &str) -> Value {
    try_eval(ctx, s).expect("error evaluating formula")
}
#[track_caller]
pub(crate) fn eval_to_string(ctx: &Grid, s: &str) -> String {
    eval(ctx, s).to_string()
}
#[track_caller]
pub(crate) fn eval_to_err(ctx: &Grid, s: &str) -> Error {
    try_eval(ctx, s).expect_err("expected error")
}

#[track_caller]
pub(crate) fn expect_val(value: impl Into<Value>, ctx: &Grid, s: &str) {
    assert_eq!(value.into(), eval(ctx, s));
}
#[track_caller]
pub(crate) fn expect_err(error_msg: &ErrorMsg, ctx: &Grid, s: &str) {
    assert_eq!(*error_msg, eval_to_err(ctx, s).msg);
}

#[test]
fn test_formula_cell_ref() {
    let form = parse_formula("SUM($D$4, $B0, E$n6, B0, nB2)", pos![D4]).unwrap();

    let mut g = Grid::new();
    let sheet = &mut g.sheets_mut()[0];
    sheet.set_cell_value(pos![D4], 1); // $D$4 -> D4
    sheet.set_cell_value(pos![Bn2], 10); // $B0  -> Bn2
    sheet.set_cell_value(pos![Cn6], 100); // E$n6 -> Cn6
    sheet.set_cell_value(pos![nAn2], 1000); // B0   -> nAn2
    sheet.set_cell_value(pos![nD0], 10000); // nB2  -> nD0
    let sheet_id = sheet.id;

    // Evaluate at D4, causing a circular reference.
    let mut ctx = Ctx::new(&g, pos![D4].with_sheet(sheet_id));
    assert_eq!(
        ErrorMsg::CircularReference,
        form.eval(&mut ctx).unwrap_err().msg,
    );

    // Evaluate at B2
    let mut ctx = Ctx::new(&g, pos![B2].with_sheet(sheet_id));
    assert_eq!(
        "11111".to_string(),
        form.eval(&mut ctx).unwrap().to_string(),
    );
}

#[test]
fn test_formula_circular_array_ref() {
    let form = parse_formula("$B$0:$C$4", pos![A0]).unwrap();

    let g = Grid::new();
    let mut ctx = Ctx::new(&g, pos![B2].with_sheet(g.sheets()[0].id));

    assert_eq!(
        ErrorMsg::CircularReference,
        form.eval(&mut ctx).unwrap_err().msg,
    )
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
        ErrorMsg::Unexpected("ellipsis".into()),
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
    assert_eq!(ErrorMsg::NonRectangularArray, eval_to_err(&g, "{;,;}").msg,);
}

#[test]
fn test_formula_array_op() {
    let mut g = Grid::new();
    let sheet = &mut g.sheets_mut()[0];
    for x in 1..=4 {
        for y in 1..=4 {
            sheet.set_cell_value(Pos { x, y }, x * 10 + y);
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
        ErrorMsg::NonRectangularArray,
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
    g.sheets_mut()[0].set_cell_value(pos![Z1], 30);
    assert_eq!("25", eval_to_string(&g, "Z1 - 5"));
    assert_eq!("25", eval_to_string(&g, "Z1-5"));
}

#[test]
fn test_formula_omit_required_argument() {
    let g = Grid::new();
    assert!(eval_to_string(&g, "ATAN2(,1)").starts_with("1.57"));
    assert_eq!("0", eval_to_string(&g, "ATAN2(1,)"));
    assert_eq!(ErrorMsg::DivideByZero, eval_to_err(&g, "ATAN2(,)").msg,);
    assert_eq!(
        ErrorMsg::MissingRequiredArgument {
            func_name: "ATAN2".into(),
            arg_name: "x".into(),
        },
        eval_to_err(&g, "ATAN2()").msg,
    );
    assert_eq!(
        ErrorMsg::MissingRequiredArgument {
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
    use CellRefCoord::{Absolute, Relative};

    // Evaluate at D4.
    let base = pos![D4];
    let refs = find_cell_references("SUM($C$4, $A0 : nQ7, :D$n6, A0:, ZB2)", base);
    let mut iter = refs.into_iter().map(|r| r.inner);

    // $C$4
    assert_eq!(
        iter.next(),
        Some(RangeRef::from(CellRef::absolute(None, pos![C4]))),
    );

    // $A0:nQ7
    assert_eq!(
        iter.next(),
        Some(RangeRef::CellRange {
            start: CellRef {
                sheet: None,
                x: Absolute(col![A]),
                y: Relative(0 - base.y),
            },
            end: CellRef {
                sheet: None,
                x: Relative(col![nQ] - base.x),
                y: Relative(7 - base.y),
            },
        }),
    );

    // D$n6
    assert_eq!(
        iter.next(),
        Some(RangeRef::from(CellRef {
            sheet: None,
            x: Relative(col![D] - base.x),
            y: Absolute(-6),
        })),
    );

    // A0
    assert_eq!(
        iter.next(),
        Some(RangeRef::from(CellRef {
            sheet: None,
            x: Relative(col![A] - base.x),
            y: Relative(0 - base.y),
        })),
    );

    // ZB2
    assert_eq!(
        iter.next(),
        Some(RangeRef::from(CellRef {
            sheet: None,
            x: Relative(col![ZB] - base.x),
            y: Relative(2 - base.y),
        })),
    );

    assert_eq!(iter.next(), None);
}

/// Regression test for quadratic#410
#[test]
fn test_currency_string() {
    let g = Grid::new();
    assert_eq!("30", eval_to_string(&g, "\"$10\" + 20"));
}
