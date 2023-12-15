use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, CodeCellValue},
    util::date_string,
    Array, CellValue, SheetPos, SheetRect,
};

use super::operation::Operation;

impl GridController {
    pub fn set_cell_code_operations(
        &mut self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
    ) -> Vec<Operation> {
        let sheet = self.grid.sheet_mut_from_id(sheet_pos.sheet_id);
        let mut ops = vec![];

        // remove any values that were originally over the code cell
        if sheet.get_cell_value_only(sheet_pos.into()).is_some() {
            ops.push(Operation::SetCellValues {
                sheet_rect: SheetRect::from(sheet_pos),
                values: Array::from(CellValue::Blank),
            });
        }

        ops.push(Operation::SetCellCode {
            sheet_pos,
            code_cell_value: Some(CodeCellValue {
                language,
                code_string,
                formatted_code_string: None,
                output: None,
                last_modified: date_string(),
            }),
        });

        ops
    }
}
