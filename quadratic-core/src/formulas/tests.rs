use super::*;

#[derive(Debug, Default, Copy, Clone)]
struct PanicGridMock;
impl GridProxy for PanicGridMock {
    fn get(&self, _pos: Pos) -> Option<String> {
        panic!("no cell should be accessed")
    }
}

#[test]
fn test_formula_cell_ref() {
    let formula = parse_formula("SUM($C$4, $A0, D$n6, A0, ZB2)", Pos::new(3, 4)).unwrap();

    #[derive(Debug, Default, Copy, Clone)]
    struct GridMock;
    impl GridProxy for GridMock {
        fn get(&self, pos: Pos) -> Option<String> {
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
        formula.eval(&GridMock, Pos::new(3, 4),).unwrap_err().msg,
    );

    assert_eq!(
        "11111".to_string(),
        formula
            .eval(&GridMock, Pos::new(0, 0),)
            .unwrap()
            .to_string(),
    );
}
