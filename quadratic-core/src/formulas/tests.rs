use async_trait::async_trait;
use smallvec::smallvec;
use std::fmt;

pub(crate) use super::*;

/// `GridProxy` implementation that just panics whenever a cell is accessed.
#[derive(Debug, Default, Copy, Clone)]
pub(crate) struct NoGrid;
#[async_trait(?Send)]
impl GridProxy for NoGrid {
    async fn get(&mut self, _pos: Pos) -> Option<String> {
        panic!("no cell should be accessed")
    }
}

pub(crate) fn eval_to_string(grid: &mut dyn GridProxy, s: &str) -> String {
    eval(grid, s).unwrap().to_string()
}
pub(crate) fn eval(grid: &mut dyn GridProxy, s: &str) -> FormulaResult {
    parse_formula(s, Pos::ORIGIN)?
        .eval_blocking(grid, Pos::ORIGIN)
        .map(|value| value.inner)
}

/// `GridProxy` implementation that calls a function for grid access.
#[derive(Copy, Clone)]
pub(crate) struct FnGrid<F>(pub F)
// Include `where` bounds here to help type inference when constructing.
where
    F: FnMut(Pos) -> Option<String>;
impl<F> fmt::Debug for FnGrid<F>
where
    F: FnMut(Pos) -> Option<String>,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("FnGrid").finish_non_exhaustive()
    }
}
#[async_trait(?Send)]
impl<F> GridProxy for FnGrid<F>
where
    F: FnMut(Pos) -> Option<String>,
{
    async fn get(&mut self, pos: Pos) -> Option<String> {
        self.0(pos)
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
            None
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
fn test_formula_array_op() {
    let mut g = FnGrid(|pos| Some((pos.x * 10 + pos.y).to_string()));

    let f = |x| Value::Number(x as f64);

    assert_eq!((11 * 31).to_string(), eval_to_string(&mut g, "B1 * D1"));
    assert_eq!(
        Value::Array(vec![
            smallvec![f(11 * 31), f(21 * 31)],
            smallvec![f(12 * 31), f(22 * 31)],
            smallvec![f(13 * 31), f(23 * 31)],
            smallvec![f(14 * 31), f(24 * 31)],
        ]),
        eval(&mut g, "B1:C4 * D1").unwrap(),
    );
    assert_eq!(
        Value::Array(vec![
            smallvec![f(11 * 31), f(11 * 41)],
            smallvec![f(11 * 32), f(11 * 42)],
            smallvec![f(11 * 33), f(11 * 43)],
            smallvec![f(11 * 34), f(11 * 44)],
        ]),
        eval(&mut g, "B1 * D1:E4").unwrap(),
    );
    assert_eq!(
        Value::Array(vec![
            smallvec![f(11 * 31), f(21 * 41)],
            smallvec![f(12 * 32), f(22 * 42)],
            smallvec![f(13 * 33), f(23 * 43)],
            smallvec![f(14 * 34), f(24 * 44)],
        ]),
        eval(&mut g, "B1:C4 * D1:E4").unwrap(),
    );
    assert_eq!(
        "Array size mismatch: expected (4, 2), got (5, 2)",
        eval(&mut g, "B1:C4 * D1:E5").unwrap_err().msg.to_string(),
    );
}

#[test]
fn test_array_parsing() {
    let f = |x| Value::Number(x as f64);
    assert_eq!(
        Value::Array(vec![
            smallvec![f(11), f(12)],
            smallvec![f(21), f(22)],
            smallvec![f(31), f(32)],
        ]),
        eval(&mut NoGrid, "{11, 12; 21, 22; 31, 32}").unwrap(),
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
        eval(&mut NoGrid, "{1; 3, 4}").unwrap_err().msg,
    );

    // Empty array
    assert!(eval(&mut NoGrid, "{}").is_err());
    assert!(eval(&mut NoGrid, "{ }").is_err());

    // Empty row
    assert!(eval(&mut NoGrid, "{ ; }").is_err());
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
