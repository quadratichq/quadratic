use crate::Pos;

use super::*;

#[test]
fn test_codestore() {
    let mut cs = CodeStore::new();

    let result = cs.set_cell_code(
        Pos::new(0, 0),
        Some(CodeCell {
            code_type: CodeType::Formula,
            code: "SUM(R1C1, R1C2)".to_string(),
        }),
    );

    assert!(result.is_none());

    let result = cs.set_cell_code(
        Pos::new(0, 0),
        Some(CodeCell {
            code_type: CodeType::Formula,
            code: "SUM(R1C1, R1C2, R1C3)".to_string(),
        }),
    );

    assert!(result.is_some());
    assert_eq!(
        result,
        Some(CodeCell {
            code_type: CodeType::Formula,
            code: "SUM(R1C1, R1C2)".to_string(),
        })
    ); // previous code value
}
