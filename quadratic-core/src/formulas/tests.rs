use async_trait::async_trait;
use std::fmt;

pub(crate) use super::*;

macro_rules! array {
    ($( $( $value:expr ),+ );+ $(;)?) => {{
        let values = [$( [$( BasicValue::from($value) ),+] ),+];
        let height = values.len();
        let width = values[0].len(); // This will generate a compile-time error if there are no values.
        Array::new_row_major(
            width as u32,
            height as u32,
            values.into_iter().flatten().collect(),
        )
        .unwrap()
    }};
}

pub(crate) fn try_eval(grid: &mut dyn GridProxy, s: &str) -> FormulaResult<Value> {
    println!("Evaluating formula {s:?}");
    parse_formula(s, Pos::ORIGIN)?.eval_blocking(grid, Pos::ORIGIN)
}
#[track_caller]
pub(crate) fn eval(grid: &mut dyn GridProxy, s: &str) -> Value {
    try_eval(grid, s).expect("error evaluating formula")
}
#[track_caller]
pub(crate) fn eval_to_string(grid: &mut dyn GridProxy, s: &str) -> String {
    eval(grid, s).to_string()
}
#[track_caller]
pub(crate) fn eval_to_err(grid: &mut dyn GridProxy, s: &str) -> FormulaError {
    try_eval(grid, s).expect_err("expected error")
}

#[track_caller]
pub(crate) fn expect_val(value: impl Into<Value>, grid: &mut dyn GridProxy, s: &str) {
    assert_eq!(value.into(), eval(grid, s));
}
#[track_caller]
pub(crate) fn expect_err(error_msg: &FormulaErrorMsg, grid: &mut dyn GridProxy, s: &str) {
    assert_eq!(*error_msg, eval_to_err(grid, s).msg);
}

/// `GridProxy` implementation that just panics whenever a cell is accessed.
#[derive(Debug, Default, Copy, Clone)]
pub(crate) struct NoGrid;
#[async_trait(?Send)]
impl GridProxy for NoGrid {
    async fn get(&mut self, _pos: Pos) -> BasicValue {
        panic!("no cell should be accessed")
    }
}

/// `GridProxy` implementation that always returns empty cells.
#[derive(Debug, Default, Copy, Clone)]
pub(crate) struct BlankGrid;
#[async_trait(?Send)]
impl GridProxy for BlankGrid {
    async fn get(&mut self, _pos: Pos) -> BasicValue {
        BasicValue::Blank
    }
}

/// `GridProxy` implementation that calls a function for grid access.
#[derive(Copy, Clone)]
pub(crate) struct FnGrid<F, T>(pub F)
// Include `where` bounds here to help type inference when constructing.
where
    F: FnMut(Pos) -> T;
impl<F, T> fmt::Debug for FnGrid<F, T>
where
    F: FnMut(Pos) -> T,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("FnGrid").finish_non_exhaustive()
    }
}
#[async_trait(?Send)]
impl<F, T> GridProxy for FnGrid<F, T>
where
    F: FnMut(Pos) -> T,
    T: Into<BasicValue>,
{
    async fn get(&mut self, pos: Pos) -> BasicValue {
        self.0(pos).into()
    }
}

/// `GridProxy` implementation with an array starting at (x, y) and no values
/// anywhere else in the sheet.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ArrayGrid(pub Pos, pub Array);
#[async_trait(?Send)]
impl GridProxy for ArrayGrid {
    async fn get(&mut self, pos: Pos) -> BasicValue {
        let x = pos.x - self.0.x;
        let y = pos.y - self.0.y;

        if x < 0 || y < 0 {
            return BasicValue::Blank;
        }
        self.1
            .get(x as u32, y as u32)
            .cloned()
            .unwrap_or(BasicValue::Blank)
    }
}

#[test]
fn test_formula_cell_ref() {
    let form = parse_formula("SUM($D$4, $B0, E$n6, B0, nB2)", pos![D4]).unwrap();

    let mut g = FnGrid(|pos| {
        Some(match (pos.x, pos.y) {
            // The formula was parsed at D4, but we'll be evaluating it from B2 so
            // adjust the cell coordinates accordingly.
            (3, 4) => "1".to_string(),      // $D$4 -> D4
            (1, -2) => "10".to_string(),    // $B0  -> Bn2
            (2, -6) => "100".to_string(),   // E$n6 -> Cn6
            (-1, -2) => "1000".to_string(), // B0   -> nAn2
            (-4, 0) => "10000".to_string(), // nB2  -> nD0
            _ => panic!("cell {pos} shouldn't be accessed"),
        })
    });

    // Evaluate at D4, causing a circular reference.
    assert_eq!(
        FormulaErrorMsg::CircularReference,
        form.eval_blocking(&mut g, pos![D4]).unwrap_err().msg,
    );

    // Evaluate at B2
    assert_eq!(
        "11111".to_string(),
        form.eval_blocking(&mut g, pos![B2]).unwrap().to_string(),
    );
}

#[test]
fn test_formula_circular_array_ref() {
    let form = parse_formula("$B$0:$C$4", pos![A0]).unwrap();

    let mut g = FnGrid(|pos| {
        if pos == pos![B2] {
            panic!("cell {pos} shouldn't be accessed")
        } else {
            ()
        }
    });

    assert_eq!(
        FormulaErrorMsg::CircularReference,
        form.eval_blocking(&mut g, pos![B2]).unwrap_err().msg,
    )
}

#[test]
fn test_formula_range_operator() {
    let expected = "{1; 2; 3; 4; 5}";
    let all_a = ["1", "1.0", ".9"];
    let all_ops = ["..", " ..", " .. ", ".. "];
    let all_b = ["5", "5.0", "5."];
    for (a, op, b) in itertools::iproduct!(all_a, all_ops, all_b) {
        let actual = eval_to_string(&mut NoGrid, &format!("{a}{op}{b}"));
        assert_eq!(expected, actual);
    }

    assert_eq!(
        FormulaErrorMsg::Unexpected("ellipsis".into()),
        parse_formula("1...5", Pos::ORIGIN).unwrap_err().msg,
    );
}

#[test]
fn test_formula_blank_array_parsing() {
    let g = &mut BlankGrid;
    const B: BasicValue = BasicValue::Blank;
    assert_eq!(Value::from(array![B]), eval(g, "{}"));
    assert_eq!(Value::from(array![B; B]), eval(g, "{;}"));
    assert_eq!(Value::from(array![B, B]), eval(g, "{,}"));
    assert_eq!(Value::from(array![B, B; B, B]), eval(g, "{,;,}"));
    assert_eq!(
        FormulaErrorMsg::NonRectangularArray,
        eval_to_err(g, "{;,;}").msg,
    );
}

#[test]
fn test_formula_array_op() {
    let mut g = FnGrid(|pos| Some((pos.x * 10 + pos.y).to_string()));

    assert_eq!((11 * 31).to_string(), eval_to_string(&mut g, "B1 * D1"));
    assert_eq!(
        Value::from(array![
            11 * 31, 21 * 31;
            12 * 31, 22 * 31;
            13 * 31, 23 * 31;
            14 * 31, 24 * 31;
        ]),
        eval(&mut g, "B1:C4 * D1"),
    );
    assert_eq!(
        Value::from(array![
            11 * 31, 11 * 41;
            11 * 32, 11 * 42;
            11 * 33, 11 * 43;
            11 * 34, 11 * 44;
        ]),
        eval(&mut g, "B1 * D1:E4"),
    );
    assert_eq!(
        Value::from(array![
            11 * 31, 21 * 41;
            12 * 32, 22 * 42;
            13 * 33, 23 * 43;
            14 * 34, 24 * 44;
        ]),
        eval(&mut g, "B1:C4 * D1:E4"),
    );
    assert_eq!(
        "Array height mismatch: expected value with 1 row or 4 rows, got 5 rows",
        eval_to_err(&mut g, "B1:C4 * D1:E5").msg.to_string(),
    );
}

#[test]
fn test_array_parsing() {
    let f = |x| BasicValue::Number(x as f64);
    assert_eq!(
        Value::from(array![
            f(11), f(12);
            f(21), f(22);
            f(31), f(32);
        ]),
        eval(&mut NoGrid, "{11, 12; 21, 22; 31, 32}"),
    );

    // Test stringification
    assert_eq!(
        "{11, 12; 21, 22; 31, 32}",
        eval_to_string(&mut NoGrid, "{11,   12 ;21, 22;31,32}"),
    );

    // Single row
    assert_eq!("{11, 12, 13}", eval_to_string(&mut NoGrid, "{11, 12, 13}"),);

    // Single column
    assert_eq!("{11; 12; 13}", eval_to_string(&mut NoGrid, "{11; 12; 13}"),);

    // Mismatched rows
    assert_eq!(
        FormulaErrorMsg::NonRectangularArray,
        eval_to_err(&mut NoGrid, "{1; 3, 4}").msg,
    );

    // Blank values
    assert_eq!("{}", eval_to_string(&mut NoGrid, "{}"));
    assert_eq!("{}", eval_to_string(&mut NoGrid, "{ }"));

    // Empty row
    assert_eq!("{; }", eval_to_string(&mut NoGrid, "{ ; }"));
}

#[test]
fn test_bool_parsing() {
    let g = &mut NoGrid;

    assert_eq!("1", eval_to_string(g, "IF(TRUE, 1, 2)"));
    assert_eq!("1", eval_to_string(g, "IF(true(), 1, 2)"));
    assert_eq!("2", eval_to_string(g, "IF(False, 1, 2)"));
    assert_eq!("2", eval_to_string(g, "IF(FALSE(), 1, 2)"));
}

#[test]
fn test_leading_equals() {
    assert_eq!("7", eval_to_string(&mut NoGrid, "=3+4"));
    assert_eq!("7", eval_to_string(&mut NoGrid, "= 3+4"));
}

/// Regression test for quadratic#253
#[test]
fn test_hyphen_after_cell_ref() {
    let mut g = FnGrid(|_| Some("30".to_string()));
    assert_eq!("25", eval_to_string(&mut g, "Z1 - 5"));
    assert_eq!("25", eval_to_string(&mut g, "Z1-5"));
}

#[test]
fn test_formula_omit_required_argument() {
    let g = &mut NoGrid;
    assert!(eval_to_string(g, "ATAN2(,1)").starts_with("1.57"));
    assert_eq!("0", eval_to_string(g, "ATAN2(1,)"));
    assert_eq!(
        FormulaErrorMsg::DivideByZero,
        eval_to_err(g, "ATAN2(,)").msg,
    );
    assert_eq!(
        FormulaErrorMsg::MissingRequiredArgument {
            func_name: "ATAN2",
            arg_name: "x"
        },
        eval_to_err(g, "ATAN2()").msg,
    );
    assert_eq!(
        FormulaErrorMsg::MissingRequiredArgument {
            func_name: "ATAN2",
            arg_name: "y"
        },
        eval_to_err(g, "ATAN2(1)").msg,
    );
}

#[test]
fn test_formula_blank_to_string() {
    let g = &mut NoGrid;
    assert_eq!("", eval_to_string(g, "IF(1=1,,)"));
}

#[test]
fn test_find_cell_references() {
    use CellRefCoord::{Absolute, Relative};

    // Evaluate at D4.
    let base = pos![D4];
    let refs = find_cell_references("SUM($C$4, $A0 : nQ7, :D$n6, A0:, ZB2)", base);
    let mut iter = refs.iter().map(|r| r.inner);

    // $C$4
    assert_eq!(
        iter.next(),
        Some(RangeRef::Cell(CellRef::absolute(pos![C4]))),
    );

    // $A0:nQ7
    assert_eq!(
        iter.next(),
        Some(RangeRef::CellRange(
            CellRef {
                x: Absolute(col![A]),
                y: Relative(0 - base.y),
            },
            CellRef {
                x: Relative(col![nQ] - base.x),
                y: Relative(7 - base.y),
            },
        )),
    );

    // D$n6
    assert_eq!(
        iter.next(),
        Some(RangeRef::Cell(CellRef {
            x: Relative(col![D] - base.x),
            y: Absolute(-6),
        })),
    );

    // A0
    assert_eq!(
        iter.next(),
        Some(RangeRef::Cell(CellRef {
            x: Relative(col![A] - base.x),
            y: Relative(0 - base.y),
        })),
    );

    // ZB2
    assert_eq!(
        iter.next(),
        Some(RangeRef::Cell(CellRef {
            x: Relative(col![ZB] - base.x),
            y: Relative(2 - base.y),
        })),
    );

    assert_eq!(iter.next(), None);
}

/// Regression test for quadratic#410
#[test]
fn test_currency_string() {
    assert_eq!("30", eval_to_string(&mut NoGrid, "\"$10\" + 20"));
}
