use super::operation::Operation;
use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, CodeRun, SheetId},
    Array, CellValue, CodeCellValue, SheetPos,
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

    // Returns whether a code_cell is dependent on another code_cell.
    fn is_dependent_on(&self, current_pos: SheetPos, other: &CodeRun) -> bool {
        let sheet_current = self.try_sheet(current.sheet_id);
        let sheet_other = self.try_sheet(other.sheet_id);
        if let (Some(sheet_current), Some(sheet_other)) = (sheet_current, sheet_other) {
            let current = sheet_current.cell_value(current.into());
            let other = sheet_other.cell_value(other.into());
            if let (Some(other), Some(current)) = (other, current) {
                if let (CellValue::Code(other), CellValue::Code(current)) = (other, current) {
                    // todo
                    return other.language == current.language;
                }
            }
        }
        false
    }

    fn order_code_cells(&self, code_cell_positions: &mut Vec<(SheetPos, &CodeRun)>) {
        // Change the ordering of code_cell_positions to ensure earlier operations do not depend on later operations.
        //
        // Algorithm: iterate through all code cells and check if they are dependent on later code cells. If they are,
        // move them to the position after the later code cell and restart the iteration at the next code cell. Note:
        // this is different from sorting as we need to compare all code cells against every other code cell to find
        // the ordering.
        let mut i = 0;
        loop {
            let current = code_cell_positions[i];
            let mut changed = false;
            for j in (i + 1)..code_cell_positions.len() {
                let other = code_cell_positions[j];
                if self.is_dependent_on(other.0, current.1) {
                    // move the current code cell to the position after the other code cell
                    code_cell_positions.remove(i);
                    code_cell_positions.insert(j + 1, current);
                    changed = true;
                    break;
                }
            }
            if !changed {
                i += 1;

                // only iterate to the second to last element as the last element will always be in the correct position
                if i == code_cell_positions.len() - 1 {
                    break;
                }
            }
        }
    }

    /// Reruns all code cells in a Sheet.
    pub fn rerun_code_cells_operations(&self, sheet_id: SheetId) -> Vec<Operation> {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return vec![];
        };
        let mut code_cell_positions = sheet
            .code_runs
            .iter()
            .map(|(pos, code_run)| (pos.to_sheet_pos(sheet_id), code_run))
            .collect::<Vec<_>>();

        self.order_code_cells(&mut code_cell_positions);

        code_cell_positions
            .iter()
            .map(|sheet_pos| Operation::ComputeCode {
                sheet_pos: *sheet_pos,
            })
            .collect()
    }

    /// Reruns all code cells in all Sheets.
    pub fn rerun_all_code_cells_operations(&self) -> Vec<Operation> {
        let mut code_cell_positions = self
            .grid()
            .sheets()
            .iter()
            .flat_map(|sheet| {
                sheet
                    .code_runs
                    .iter()
                    .map(|(pos, _)| pos.to_sheet_pos(sheet.id))
            })
            .collect::<Vec<_>>();

        self.order_code_cells(&mut code_cell_positions);

        code_cell_positions
            .iter()
            .map(|sheet_pos| Operation::ComputeCode {
                sheet_pos: *sheet_pos,
            })
            .collect()
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

    #[test]
    fn rerun_all_code_cells_operations() {}
}
