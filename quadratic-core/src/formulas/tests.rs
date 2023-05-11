use async_trait::async_trait;
use smallvec::smallvec;

use super::*;

macro_rules! make_stateless_grid_mock {
    ($function_body:expr) => {
        #[derive(Debug, Default, Copy, Clone)]
        struct GridMock;
        #[async_trait(?Send)]
        impl GridProxy for GridMock {
            async fn get(&mut self, pos: Pos) -> Option<String> {
                let f: fn(Pos) -> Option<String> = $function_body;
                f(pos)
            }
        }
    };
}

/// `GridProxy` implementation that just panics whenever a cell is accessed.
#[derive(Debug, Default, Copy, Clone)]
struct PanicGridMock;
#[async_trait(?Send)]
impl GridProxy for PanicGridMock {
    async fn get(&mut self, _pos: Pos) -> Option<String> {
        panic!("no cell should be accessed")
    }
}

#[test]
fn test_formula_indirect() {
    let form = parse_formula_a1("INDIRECT(\"D5\")", pos![B2]).unwrap();

    make_stateless_grid_mock!(|pos| Some((pos.x * 10 + pos.y).to_string()));

    assert_eq!(
        FormulaErrorMsg::CircularReference,
        form.eval_blocking(&mut GridMock, pos![D5]).unwrap_err().msg,
    );

    assert_eq!(
        (3 * 10 + 5).to_string(),
        eval_to_string(&mut GridMock, "INDIRECT(\"D5\")"),
    );
}

#[test]
fn test_formula_cell_ref() {
    let form = parse_formula_a1("SUM($D$4, $B0, E$n6, B0, nB2)", pos![D4]).unwrap();

    make_stateless_grid_mock!(|pos| Some(match (pos.x, pos.y) {
        // The formula was parsed at D4, but we'll be evaluating it from B2 so
        // adjust the cell coordinates accordingly.
        (3, 4) => "1".to_string(),      // $D$4 -> D4
        (1, -2) => "10".to_string(),    // $B0  -> Bn2
        (2, -6) => "100".to_string(),   // E$n6 -> Cn6
        (-1, -2) => "1000".to_string(), // B0   -> nAn2
        (-4, 0) => "10000".to_string(), // nB2  -> nD0
        _ => panic!("cell {pos} shouldn't be accessed"),
    }));

    // Evaluate at D4, causing a circular reference.
    assert_eq!(
        FormulaErrorMsg::CircularReference,
        form.eval_blocking(&mut GridMock, pos![D4]).unwrap_err().msg,
    );

    // Evaluate at B2
    assert_eq!(
        "11111".to_string(),
        form.eval_blocking(&mut GridMock, pos![B2])
            .unwrap()
            .to_string(),
    );
}

#[test]
fn test_formula_circular_array_ref() {
    let form = parse_formula_a1("$B$0:$C$4", pos![A0]).unwrap();

    make_stateless_grid_mock!(|pos| {
        if pos == pos![B2] {
            panic!("cell {pos} shouldn't be accessed")
        } else {
            None
        }
    });

    assert_eq!(
        FormulaErrorMsg::CircularReference,
        form.eval_blocking(&mut GridMock, pos![B2]).unwrap_err().msg,
    )
}

#[test]
fn test_formula_math_operators() {
    assert_eq!(
        (1 * -6 + -2 - 1 * (-3_i32).pow(2_u32.pow(3))).to_string(),
        eval_to_string(&mut PanicGridMock, "1 * -6 + -2 - 1 * -3 ^ 2 ^ 3"),
    );
}

#[test]
fn test_formula_range_operator() {
    let expected = "{1; 2; 3; 4; 5}";
    let all_a = ["1", "1.0", ".9"];
    let all_ops = ["..", " ..", " .. ", ".. "];
    let all_b = ["5", "5.0", "5."];
    for (a, op, b) in itertools::iproduct!(all_a, all_ops, all_b) {
        let actual = eval_to_string(&mut PanicGridMock, &format!("{a}{op}{b}"));
        assert_eq!(expected, actual);
    }

    assert_eq!(
        FormulaErrorMsg::Unexpected("ellipsis".into()),
        parse_formula_a1("1...5", Pos::ORIGIN).unwrap_err().msg,
    );
}

#[test]
fn test_formula_concat() {
    assert_eq!(
        "Hello, 14000605 worlds!".to_string(),
        eval_to_string(&mut PanicGridMock, "'Hello, ' & 14000605 & ' worlds!'"),
    );
}

#[test]
fn test_formula_if() {
    let form = parse_formula_a1("IF(A1=2, 'yep', 'nope')", pos![A0]).unwrap();

    make_stateless_grid_mock!(|pos| Some(match (pos.x, pos.y) {
        (0, 1) => "2".to_string(),
        (1, 1) => "16".to_string(),
        _ => panic!("cell {pos} shouldn't be accessed"),
    }));

    assert_eq!(
        "yep".to_string(),
        form.eval_blocking(&mut GridMock, pos![A0])
            .unwrap()
            .to_string(),
    );
    assert_eq!(
        "nope".to_string(),
        form.eval_blocking(&mut GridMock, pos![B0])
            .unwrap()
            .to_string(),
    );
}

#[test]
fn test_formula_average() {
    let form = parse_formula_a1("AVERAGE(3, B1:D3)", pos![nAn1]).unwrap();

    make_stateless_grid_mock!(|pos| {
        if (1..=3).contains(&pos.x) && (1..=3).contains(&pos.y) {
            Some((pos.x * 3 + pos.y).to_string()) // 4 .. 12
        } else {
            panic!("cell {pos} shouldn't be accessed")
        }
    });

    assert_eq!(
        "7.5".to_string(),
        form.eval_blocking(&mut GridMock, pos![nAn1])
            .unwrap()
            .to_string(),
    );
}

#[test]
fn test_formula_array_op() {
    make_stateless_grid_mock!(|pos| Some((pos.x * 10 + pos.y).to_string()));

    let mut g = GridMock;

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
        eval(&mut PanicGridMock, "{11, 12; 21, 22; 31, 32}").unwrap(),
    );

    // Test stringification
    assert_eq!(
        "{11, 12; 21, 22; 31, 32}",
        eval_to_string(&mut PanicGridMock, "{11,   12 ;21, 22;31,32}"),
    );

    // Single row
    assert_eq!(
        "{11, 12, 13}",
        eval_to_string(&mut PanicGridMock, "{11, 12, 13}"),
    );

    // Single column
    assert_eq!(
        "{11; 12; 13}",
        eval_to_string(&mut PanicGridMock, "{11; 12; 13}"),
    );

    // Mismatched rows
    assert_eq!(
        FormulaErrorMsg::NonRectangularArray,
        eval(&mut PanicGridMock, "{1; 3, 4}").unwrap_err().msg,
    );

    // Empty array
    assert!(eval(&mut PanicGridMock, "{}").is_err());
    assert!(eval(&mut PanicGridMock, "{ }").is_err());

    // Empty row
    assert!(eval(&mut PanicGridMock, "{ ; }").is_err());
}

#[test]
fn test_leading_equals() {
    assert_eq!("7", eval_to_string(&mut PanicGridMock, "=3+4"));
    assert_eq!("7", eval_to_string(&mut PanicGridMock, "= 3+4"));
}

/// Regression test for quadratic#253
#[test]
fn test_hyphen_after_cell_ref() {
    make_stateless_grid_mock!(|_| Some("30".to_string()));
    assert_eq!("25", eval_to_string(&mut GridMock, "Z1 - 5"));
    assert_eq!("25", eval_to_string(&mut GridMock, "Z1-5"));
}

fn eval_to_string(grid: &mut dyn GridProxy, s: &str) -> String {
    eval(grid, s).unwrap().to_string()
}
fn eval(grid: &mut dyn GridProxy, s: &str) -> FormulaResult {
    parse_formula_a1(s, Pos::ORIGIN)?
        .eval_blocking(grid, Pos::ORIGIN)
        .map(|value| value.inner)
}

#[test]
fn test_find_cell_references_a1() {
    use CellRefCoord::{Absolute, Relative};

    // Evaluate at D4.
    let base = pos![D4];
    let cfg = ParseConfig {
        pos: base,
        cell_ref_notation: CellRefNotation::A1,
    };
    let refs = find_cell_references("SUM($C$4, $A0 : nQ7, :D$n6, A0:, ZB2)", cfg);
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

    // Test that RC-style cell references fail to parse.
    let cfg = ParseConfig {
        pos: base,
        cell_ref_notation: CellRefNotation::A1,
    };
    assert!(parse_formula("R1C1", cfg).is_err());
    assert!(parse_formula("R[1]C1", cfg).is_err());
    assert!(parse_formula("R1C[1]", cfg).is_err());
    assert!(parse_formula("R[1]C[1]", cfg).is_err());
}

#[test]
fn test_find_cell_references_rc() {
    use CellRefCoord::{Absolute, Relative};

    // Evaluate at D4 (although it shouldn't matter).
    let base = pos![D4];
    let cfg = ParseConfig {
        pos: base,
        cell_ref_notation: CellRefNotation::RC,
    };
    let refs = find_cell_references(
        "SUM(R4C5, R0C[-4] : Rn12C3, :R[0]Cn6, R[2]C[3]:, Rn99C[-99])",
        cfg,
    );
    let mut iter = refs.iter().map(|r| r.inner);

    // R4C5
    assert_eq!(
        iter.next(),
        Some(RangeRef::Cell(CellRef::absolute(Pos { x: 5, y: 4 }))),
    );

    // R0C[-4]:Rn12C3
    assert_eq!(
        iter.next(),
        Some(RangeRef::CellRange(
            CellRef {
                x: Relative(-4),
                y: Absolute(0),
            },
            CellRef {
                x: Absolute(3),
                y: Absolute(-12),
            },
        )),
    );

    // R[0]Cn6
    assert_eq!(
        iter.next(),
        Some(RangeRef::Cell(CellRef {
            x: Absolute(-6),
            y: Relative(0),
        })),
    );

    // R[2]C[3]
    assert_eq!(
        iter.next(),
        Some(RangeRef::Cell(CellRef {
            x: Relative(3),
            y: Relative(2),
        })),
    );

    // Rn99C[-99]
    assert_eq!(
        iter.next(),
        Some(RangeRef::Cell(CellRef {
            x: Relative(-99),
            y: Absolute(-99),
        })),
    );

    assert_eq!(iter.next(), None);

    // Test that RC-style cell references fail to parse.
    let cfg = ParseConfig {
        pos: base,
        cell_ref_notation: CellRefNotation::RC,
    };
    assert!(parse_formula("A1", cfg).is_err());
    assert!(parse_formula("nA0", cfg).is_err());
    assert!(parse_formula("Rn1", cfg).is_err());
    assert!(parse_formula("nRn3", cfg).is_err());
    assert!(parse_formula("C6", cfg).is_err());
    assert!(parse_formula("Cn6", cfg).is_err());
    assert!(parse_formula("nC6", cfg).is_err());
    assert!(parse_formula("nCn6", cfg).is_err());
}

/// Regression test for quadratic#410
#[test]
fn test_currency_string() {
    assert_eq!("30", eval_to_string(&mut PanicGridMock, "\"$10\" + 20"));
}
