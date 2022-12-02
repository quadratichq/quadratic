use super::*;
use crate::grid::Grid;

#[test]
fn test_formula_display() {
    let form = Formula::new_sum(&[]);
    assert_eq!(form.to_string(), "SUM()");

    let form = Formula::new_sum(&[Pos::new(2, 10)]);
    assert_eq!(form.to_string(), "SUM(R2C10)");

    let form = Formula::new_sum(&[Pos::new(2, 10), Pos::new(-6, 19)]);
    assert_eq!(form.to_string(), "SUM(R2C10, R-6C19)");
}

#[test]
fn test_formula_sum() {
    let form = Formula::new_sum(&[Pos::new(1, 3), Pos::new(1, 4), Pos::new(1, 5)]);

    let mut grid = Grid::new();
    grid.set_cell(Pos::new(1, 3), Cell::Int(10));
    grid.set_cell(Pos::new(1, 4), Cell::Text("-16.5".to_string()));

    let expected = Ok(Cell::Text((10.0 + -16.5).to_string()));
    let actual = form.eval(&grid, Pos::new(-3, 12));
    assert_eq!(expected, actual);

    grid.set_cell(Pos::new(1, 5), Cell::Text("bad number".to_string()));

    // If the formula were constructed from a string, then this error would have
    // an actual span.
    let expected = Err(FormulaErrorMsg::ExpectedNumber {
        got: "bad number".to_string(),
    }
    .with_span(&(0..0)));
    let actual = form.eval(&grid, Pos::new(-3, 12));
    assert_eq!(expected, actual)
}
