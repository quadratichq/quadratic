use crate::{
    controller::GridController,
    grid::{CodeCell, CodeCellLanguage, CodeCellRun},
    util::date_string,
    Array, CellValue, SheetPos, SheetRect,
};

use super::operation::Operation;

impl GridController {
    /// Creates operations to set a code_cell and delete any cell_values that were on that cell
    /// Existing code_cells at that location will be overwritten in the Operation::SetCodeCell.
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
            code_cell_value: Some(CodeCell {
                language,
                code_string,
                formatted_code_string: None,
                last_modified: date_string(),
            }),
        });

        // check if this causes a spill
        if

        ops.push(Operation::SetSpill {
            spill_rect: sheet_pos.into(),
            code_cell_sheet_pos: Some(sheet_pos),
        });

        ops
    }

    /// Creates operations to delete code_cell and code_cell_run, releases related Spills, and releases any SpillErrors
    pub fn delete_code_cell_operations(&self, sheet_pos: SheetPos) -> Vec<Operation> {
        let sheet = self.grid.sheet_from_id(sheet_pos.sheet_id);
        let mut ops = vec![];

        let pos = sheet_pos.into();

        // only need to check spills for the code_cell if there was no run
        let mut spills_already_checked = false;

        // add operation to delete code cell run and related spills (if any)
        if let Some(run) = sheet.get_code_cell_run(pos) {
            // only check for spills if there was no spill error
            if !run.spill_error {
                spills_already_checked = true;
                let output = run.output_size().unwrap_or_default();
                ops.push(Operation::SetSpill {
                    spill_rect: SheetRect::from_numbers(
                        sheet_pos.x,
                        sheet_pos.y,
                        output.w.get() as i64,
                        output.h.get() as i64,
                        sheet_pos.sheet_id,
                    ),
                    code_cell_sheet_pos: None,
                });
                self.check_spill_release_operations(sheet_pos);
            }
            ops.push(Operation::SetCodeCellRun {
                sheet_pos,
                code_cell_run: None,
            });
        }

        // add operation to delete code cell (if any) and related spills
        if sheet.get_code_cell(pos).is_some() {
            if !spills_already_checked {
                ops.push(Operation::SetSpill {
                    spill_rect: sheet_pos.into(),
                    code_cell_sheet_pos: None,
                }
            }
            ops.push(Operation::SetCodeCell {
                sheet_pos,
                code_cell_value: None,
            });
        }

        ops
    }

    pub fn set_code_cell_run_operations(
        &self,
        sheet_pos: SheetPos,
        code_cell_run: Option<CodeCellRun>,
    ) -> Vec<Operation> {
        let sheet = self.grid.sheet_from_id(sheet_pos.sheet_id);
        let old_run = sheet.set_code_cell_run(pos, code_cell_run);

        let mut ops = vec![];

        ops.push(Operation::SetCodeCellRun {
            sheet_pos,
            code_cell_run,
        });
        ops
    }

    pub fn check_for_spill_error_release(&self, sheet_rect: SheetRect) -> Vec<Operation> {
        match self.grid.try_sheet_from_id(sheet_rect.sheet_id) {
            None => vec![], // sheet may have been deleted in multiplayer
            Some(sheet) => {
                let mut ops = vec![];
                if let Some((sheet_pos, run)) = sheet.spill_error_released(sheet_rect) {
                    let mut run = run.clone();
                    run.spill_error = false;
                    ops.push(Operation::SetCodeCellRun {
                        sheet_pos: sheet_pos.to_sheet_pos(sheet_rect.sheet_id),
                        code_cell_run: Some(run),
                    });
                }
                ops
            }
        }

    pub fn check_for_spill_error(&self, sheet_rect: SheetRect) -> Vec<Operation> {
        match self.grid.try_sheet_from_id(sheet_rect.sheet_id) {
            None => vec![], // sheet may have been deleted in multiplayer
            Some(sheet) => {
                let mut ops = vec![];
                if let Some((sheet_pos, run)) = sheet.spill_error_released(sheet_rect) {
                    ops.push(Operation::SetCodeCellRun {
                        sheet_pos: sheet_pos.to_sheet_pos(sheet_rect.sheet_id),
                        code_cell_run: Some(run),
                    });
                }
                ops
            }
        }

    }
}
