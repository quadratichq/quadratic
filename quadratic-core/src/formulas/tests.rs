use async_trait::async_trait;

use super::*;

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
fn test_formula_cell_ref() {
    let form = parse_formula("SUM($C$4, $A0, D$n6, A0, ZB2)", Pos::new(3, 4)).unwrap();

    #[derive(Debug, Default, Copy, Clone)]
    struct GridMock;
    #[async_trait(?Send)]
    impl GridProxy for GridMock {
        async fn get(&mut self, pos: Pos) -> Option<String> {
            // The formula was parsed at C4, but we'll be evaluating it from Z0
            // so adjust the cell coordinates accordingly.
            Some(match (pos.x, pos.y) {
                (3, 4) => "1".to_string(),       // $C$4 -> C4
                (1, -4) => "10".to_string(),     // $A0  -> An4
                (1, -6) => "100".to_string(),    // D$n6 -> An6
                (-2, -4) => "1000".to_string(),  // A0   -> ZBn4
                (-5, -2) => "10000".to_string(), // ZB2  -> ZEn2
                _ => panic!("cell {pos} shouldn't be accessed"),
            })
        }
    }

    assert_eq!(
        FormulaErrorMsg::CircularReference,
        form.eval_blocking(&mut GridMock, Pos::new(3, 4))
            .unwrap_err()
            .msg,
    );

    assert_eq!(
        "11111".to_string(),
        form.eval_blocking(&mut GridMock, Pos::new(0, 0))
            .unwrap()
            .to_string(),
    );
}

#[test]
fn test_formula_math_operators() {
    let form = parse_formula("1 * -6 + -2 - 1 * -3 ^ 2 ^ 3", Pos::new(0, 0)).unwrap();

    assert_eq!(
        (1 * -6 + -2 - 1 * (-3_i32).pow(2_u32.pow(3))).to_string(),
        form.eval_blocking(&mut PanicGridMock, Pos::new(0, 0))
            .unwrap()
            .to_string(),
    );
}

#[test]
fn test_formula_concat() {
    let form = parse_formula("'Hello, ' & 14000605 & ' worlds!'", Pos::new(0, 0)).unwrap();

    assert_eq!(
        "Hello, 14000605 worlds!".to_string(),
        form.eval_blocking(&mut PanicGridMock, Pos::new(0, 0))
            .unwrap()
            .to_string(),
    );
}

#[test]
fn test_formula_if() {
    let form = parse_formula("IF(Z1=2, 'yep', 'nope')", Pos::new(0, 0)).unwrap();

    #[derive(Debug, Default, Copy, Clone)]
    struct GridMock;
    #[async_trait(?Send)]
    impl GridProxy for GridMock {
        async fn get(&mut self, pos: Pos) -> Option<String> {
            Some(match (pos.x, pos.y) {
                (0, 1) => "2".to_string(),
                (1, 1) => "16".to_string(),
                _ => panic!("cell {pos} shouldn't be accessed"),
            })
        }
    }

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
    let form = parse_formula("AVERAGE(3, A1:C3)", Pos::new(-1, -1)).unwrap();

    #[derive(Debug, Default, Copy, Clone)]
    struct GridMock;
    #[async_trait(?Send)]
    impl GridProxy for GridMock {
        async fn get(&mut self, pos: Pos) -> Option<String> {
            if (1..=3).contains(&pos.x) && (1..=3).contains(&pos.y) {
                Some((pos.x * 3 + pos.y).to_string()) // 4 ... 12
            } else {
                panic!("cell {pos} shouldn't be accessed")
            }
        }
    }

    assert_eq!(
        "7.5".to_string(),
        form.eval_blocking(&mut GridMock, Pos::new(-1, -1))
            .unwrap()
            .to_string(),
    );
}
