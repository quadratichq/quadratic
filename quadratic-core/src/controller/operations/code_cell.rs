use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, CodeCellValue},
    util::date_string,
    Array, CellValue, Pos, SheetPos, SheetRect,
};

use super::operation::Operation;

impl GridController {
    // check if any code cells need to be deleted
    pub fn delete_code_cell_operations(&self, sheet_rect: &SheetRect) -> Vec<Operation> {
        let mut ops = vec![];
        if let Some(sheet) = self.grid.try_sheet_from_id(sheet_rect.sheet_id) {
            sheet.code_cells.iter().for_each(|(pos, _)| {
                let code_sheet_pos = pos.to_sheet_pos(sheet.id);
                if sheet_rect.contains(code_sheet_pos) {
                    ops.push(Operation::SetCodeCell {
                        sheet_pos: code_sheet_pos,
                        code_cell_value: None,
                    });
                }
            });
        }
        ops
    }

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

    /// Adds operations to compute cells that are dependents within a SheetRect
    pub fn add_compute_operations(&mut self, output: &SheetRect, skip_compute: Option<SheetPos>) {
        let mut operations = vec![];
        self.get_dependent_code_cells(output)
            .iter()
            .for_each(|sheet_positions| {
                sheet_positions.iter().for_each(|code_cell_sheet_pos| {
                    if !skip_compute
                        .is_some_and(|skip_compute| skip_compute == *code_cell_sheet_pos)
                    {
                        // only add a compute operation if there isn't already one pending
                        if self
                            .operations
                            .iter()
                            .find(|op| match op {
                                Operation::SetCodeCell { sheet_pos, .. } => {
                                    code_cell_sheet_pos == sheet_pos
                                }
                                _ => false,
                            })
                            .is_none()
                        {
                            if let Some(sheet) =
                                self.grid.try_sheet_from_id(code_cell_sheet_pos.sheet_id)
                            {
                                if let Some(code_cell_value) =
                                    sheet.get_code_cell(Pos::from(*code_cell_sheet_pos))
                                {
                                    operations.push(Operation::SetCodeCell {
                                        sheet_pos: *code_cell_sheet_pos,
                                        code_cell_value: Some(code_cell_value.clone()),
                                    });
                                }
                            }
                        }
                    }
                })
            });

        self.operations.extend(operations);
    }

    /// Adds operations after a code_cell has changed
    pub fn add_code_cell_operations(
        &mut self,
        sheet_pos: SheetPos,
        old_code_cell: Option<&CodeCellValue>,
        new_code_cell: Option<&CodeCellValue>,
    ) {
        let old_sheet_rect = old_code_cell.map(|c| c.output_sheet_rect(sheet_pos, false));
        let new_sheet_rect = new_code_cell.map(|c| c.output_sheet_rect(sheet_pos, false));
        match (&old_sheet_rect, &new_sheet_rect) {
            (Some(old_sheet_rect), Some(new_sheet_rect)) => {
                let sheet_rect = old_sheet_rect.union(new_sheet_rect);
                self.add_compute_operations(&sheet_rect, Some(sheet_pos));
            }
            (Some(old_sheet_rect), None) => {
                self.add_compute_operations(old_sheet_rect, Some(sheet_pos));
            }
            (None, Some(new_sheet_rect)) => {
                self.add_compute_operations(new_sheet_rect, Some(sheet_pos));
            }
            (None, None) => {}
        }
    }
}
