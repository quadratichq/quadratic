use super::operation::Operation;
use crate::{
    controller::GridController, grid::CodeCellLanguage, Array, CellValue, CodeCellValue, SheetPos,
};

impl GridController {
    /// Adds operations to compute a CellValue::Code at the sheet_pos.
    pub fn set_code_cell_operations(
        &self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code: String,
    ) -> Vec<Operation> {
        vec![
            Operation::SetCellValues {
                sheet_rect: sheet_pos.into(),
                values: Array::from(CellValue::Code(CodeCellValue { language, code })),
            },
            Operation::ComputeCode { sheet_pos },
        ]
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{Pos, SheetRect};

    #[test]
    fn test_set_code_cell_operations() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();
        let pos = Pos { x: 0, y: 0 };
        sheet.set_cell_value(pos, CellValue::Text("delete me".to_string()));

        let operations = gc.set_code_cell_operations(
            pos.to_sheet_pos(sheet_id),
            CodeCellLanguage::Python,
            "print('hello world')".to_string(),
        );
        assert_eq!(operations.len(), 2);
        assert_eq!(
            operations[0],
            Operation::SetCellValues {
                sheet_rect: SheetRect::from(pos.to_sheet_pos(sheet_id)),
                values: Array::from(CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Python,
                    code: "print('hello world')".to_string(),
                })),
            }
        );
        assert_eq!(
            operations[1],
            Operation::ComputeCode {
                sheet_pos: pos.to_sheet_pos(sheet_id),
            }
        );
    }
}
