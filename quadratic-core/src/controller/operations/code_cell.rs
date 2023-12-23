use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, CodeCellValue},
    util::date_string,
    Array, CellValue, Pos, SheetPos, SheetRect,
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

        ops.push(Operation::ComputeCodeCell {
            sheet_pos,
            code_cell_value: CodeCellValue {
                language,
                code_string,
                formatted_code_string: None,
                output: None,
                last_modified: date_string(),
            },
        });

        ops
    }

    pub fn delete_code_cell_operations(&self, sheet_pos: SheetPos) -> Vec<Operation> {
        let sheet = self.grid.sheet_from_id(sheet_pos.sheet_id);
        let mut ops = vec![];

        // add remove code cell operation if there is a code cell
        if let Some(code_cell_value) = sheet.get_code_cell(sheet_pos.into()) {
            ops.push(Operation::ComputeCodeCell {
                sheet_pos,
                code_cell_value: code_cell_value.to_owned(),
            });
        }

        ops
    }

    /// Adds operations to compute cells that are dependents within a SheetRect
    pub fn add_compute_operations(&mut self, output: &SheetRect) {
        let mut operations = vec![];
        self.get_dependent_code_cells(output)
            .iter()
            .for_each(|sheet_positions| {
                sheet_positions.iter().for_each(|code_cell_sheet_pos| {
                    // only add a compute operation if there isn't already one
                    if self
                        .operations
                        .iter()
                        .find(|op| match op {
                            Operation::ComputeCodeCell { sheet_pos, .. } => {
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
                                operations.push(Operation::ComputeCodeCell {
                                    sheet_pos: *code_cell_sheet_pos,
                                    code_cell_value: code_cell_value.clone(),
                                });
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
        code_cell: Option<&CodeCellValue>,
        new_code_cell: Option<&CodeCellValue>,
    ) {
        let old_sheet_rect = code_cell.map(|c| c.output_sheet_rect(sheet_pos));
        let new_sheet_rect = new_code_cell.map(|c| c.output_sheet_rect(sheet_pos));
        match (&old_sheet_rect, &new_sheet_rect) {
            (Some(old_sheet_rect), Some(new_sheet_rect)) => {
                let sheet_rect = old_sheet_rect.union(new_sheet_rect);
                self.add_compute_operations(&sheet_rect);
                // self.add_spills(new_sheet_rect, sheet_pos);

                // clears spills from the right of old_sheet_rect to the right of new_sheet_rect
                let mut clear_spills = vec![];
                if old_sheet_rect.max.x > new_sheet_rect.max.x {
                    clear_spills.push(SheetRect {
                        min: Pos {
                            x: old_sheet_rect.max.x,
                            y: old_sheet_rect.min.y,
                        },
                        max: Pos {
                            x: new_sheet_rect.max.x,
                            y: old_sheet_rect.max.y,
                        },
                        sheet_id: sheet_pos.sheet_id,
                    });
                }

                // clears spills from the bottom of the old_sheet_rect to the bottom of the new_sheet_rect
                if old_sheet_rect.max.y > new_sheet_rect.max.y {
                    clear_spills.push(SheetRect {
                        min: Pos {
                            x: old_sheet_rect.min.x,
                            y: old_sheet_rect.max.y,
                        },
                        max: Pos {
                            x: old_sheet_rect.max.x,
                            y: new_sheet_rect.max.y,
                        },
                        sheet_id: sheet_pos.sheet_id,
                    });
                }
                // self.clear_spills(clear_spills);
            }
            (Some(old_sheet_rect), None) => {
                self.add_compute_operations(old_sheet_rect);
                // self.clear_spills(vec![*old_sheet_rect])
            }
            (None, Some(new_sheet_rect)) => {
                self.add_compute_operations(new_sheet_rect);
                // self.add_spills(new_sheet_rect, sheet_pos);
            }
            (None, None) => {}
        }

        self.operations.insert(
            0,
            Operation::SetCodeCell {
                sheet_pos,
                code_cell_value: new_code_cell.cloned(),
            },
        );
    }
}
