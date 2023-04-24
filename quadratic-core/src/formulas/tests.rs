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
    let form = parse_formula("CELL(3, 5)", Pos::new(1, 2)).unwrap();

    make_stateless_grid_mock!(|pos| Some((pos.x * 10 + pos.y).to_string()));

    assert_eq!(
        FormulaErrorMsg::CircularReference,
        form.eval_blocking(&mut GridMock, Pos::new(3, 5))
            .unwrap_err()
            .msg,
    );

    assert_eq!(
        (3 * 10 + 5).to_string(),
        eval_to_string(&mut GridMock, "CELL(3, 5)"),
    );
}

#[test]
fn test_formula_cell_ref() {
    let form = parse_formula("SUM($D$4, $B0, E$n6, B0, nB2)", Pos::new(3, 4)).unwrap();

    make_stateless_grid_mock!(|pos| Some(match (pos.x, pos.y) {
        // The formula was parsed at C4, but we'll be evaluating it from A2 so
        // adjust the cell coordinates accordingly.
        (3, 4) => "1".to_string(),      // $C$4 -> C4
        (1, -2) => "10".to_string(),    // $A0  -> An2
        (2, -6) => "100".to_string(),   // D$n6 -> Bn6
        (-1, -2) => "1000".to_string(), // A0   -> nAn2
        (-4, 0) => "10000".to_string(), // nB2  -> nD0
        _ => panic!("cell {pos} shouldn't be accessed"),
    }));

    // Evaluate at C4, causing a circular reference.
    assert_eq!(
        FormulaErrorMsg::CircularReference,
        form.eval_blocking(&mut GridMock, Pos::new(3, 4))
            .unwrap_err()
            .msg,
    );

    // Evaluate at A2
    assert_eq!(
        "11111".to_string(),
        form.eval_blocking(&mut GridMock, Pos::new(1, 2))
            .unwrap()
            .to_string(),
    );
}

#[test]
fn test_formula_circular_array_ref() {
    let form = parse_formula("$B$0:$C$4", Pos::new(0, 0)).unwrap();

    make_stateless_grid_mock!(|pos| {
        if pos == Pos::new(1, 2) {
            panic!("cell {pos} shouldn't be accessed")
        } else {
            None
        }
    });

    assert_eq!(
        FormulaErrorMsg::CircularReference,
        form.eval_blocking(&mut GridMock, Pos::new(1, 2))
            .unwrap_err()
            .msg,
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
fn test_formula_concat() {
    assert_eq!(
        "Hello, 14000605 worlds!".to_string(),
        eval_to_string(&mut PanicGridMock, "'Hello, ' & 14000605 & ' worlds!'"),
    );
}

#[test]
fn test_formula_if() {
    let form = parse_formula("IF(A1=2, 'yep', 'nope')", Pos::new(0, 0)).unwrap();

    make_stateless_grid_mock!(|pos| Some(match (pos.x, pos.y) {
        (0, 1) => "2".to_string(),
        (1, 1) => "16".to_string(),
        _ => panic!("cell {pos} shouldn't be accessed"),
    }));

    assert_eq!(
        "yep".to_string(),
        form.eval_blocking(&mut GridMock, Pos::new(0, 0))
            .unwrap()
            .to_string(),
    );
    assert_eq!(
        "nope".to_string(),
        form.eval_blocking(&mut GridMock, Pos::new(1, 0))
            .unwrap()
            .to_string(),
    );
}

#[test]
fn test_formula_average() {
    let form = parse_formula("AVERAGE(3, B1:D3)", Pos::new(-1, -1)).unwrap();

    make_stateless_grid_mock!(|pos| {
        if (1..=3).contains(&pos.x) && (1..=3).contains(&pos.y) {
            Some((pos.x * 3 + pos.y).to_string()) // 4 ... 12
        } else {
            panic!("cell {pos} shouldn't be accessed")
        }
    });

    assert_eq!(
        "7.5".to_string(),
        form.eval_blocking(&mut GridMock, Pos::new(-1, -1))
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

fn eval_to_string(grid: &mut impl GridProxy, s: &str) -> String {
    eval(grid, s).unwrap().to_string()
}
fn eval(grid: &mut impl GridProxy, s: &str) -> FormulaResult<Value> {
    parse_formula(s, Pos::ORIGIN)?
        .eval_blocking(grid, Pos::ORIGIN)
        .map(|value| value.inner)
}

/// Regression test for quadratic#410
#[test]
fn test_currency_string() {
    assert_eq!("30", eval_to_string(&mut PanicGridMock, "\"$10\" + 20"));
}
