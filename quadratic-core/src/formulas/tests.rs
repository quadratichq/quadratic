use super::*;

#[test]
fn test_formula_display() {
    let form = Formula::new_sum(&[]);
    assert_eq!(form.to_string(), "SUM()");

    let form = Formula::new_sum(&[Pos { x: 2, y: 10 }]);
    assert_eq!(form.to_string(), "SUM(R2C10)");

    let form = Formula::new_sum(&[Pos { x: 2, y: 10 }, Pos { x: -6, y: 19 }]);
    assert_eq!(form.to_string(), "SUM(R2C10, R-6C19)");
}
