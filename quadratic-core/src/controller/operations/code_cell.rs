use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, CodeCellValue},
    util::date_string,
    Array, CellValue, SheetPos, SheetRect,
};

use super::operation::Operation;

impl GridController {
    pub fn set_code_cell_operations(
        &self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
    ) -> Vec<Operation> {
        let sheet = self.grid.sheet_from_id(sheet_pos.sheet_id);
        let mut ops = vec![];

        // remove any values that were originally over the code cell
        if sheet.get_cell_value_only(sheet_pos.into()).is_some() {
            ops.push(Operation::SetCellValues {
                sheet_rect: SheetRect::from(sheet_pos),
                values: Array::from(CellValue::Blank),
            });
        }

        ops.push(Operation::SetCodeCell {
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

    pub fn delete_code_cell_operations(&self, sheet_pos: SheetPos) -> Vec<Operation> {
        let sheet = self.grid.sheet_from_id(sheet_pos.sheet_id);
        let mut ops = vec![];

        // add remove code cell operation if there is a code cell
        if let Some(_) = sheet.get_code_cell(sheet_pos.into()) {
            ops.push(Operation::SetCodeCell {
                sheet_pos,
                code_cell_value: None,
            });

            // todo: remove spills
        }

        ops
    }
}
