use super::operation::Operation;
use crate::{
    controller::GridController,
    grid::{CodeCell, CodeCellLanguage, CodeCellRun},
    util::date_string,
    Array, CellValue, SheetPos, SheetRect,
};

impl GridController {
    /// Creates operations to set a code_cell and delete any cell_values that were on that cell
    /// Existing code_cells at that location will be overwritten in the Operation::SetCodeCell.
    pub fn set_code_cell_operations(
        &self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
    ) -> Vec<Operation> {
        let sheet = match self.grid.try_sheet_from_id(sheet_pos.sheet_id) {
            None => return vec![], // sheet may have been deleted in multiplayer
            Some(sheet) => sheet,
        };

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
        ops.extend(self.check_for_cell_value_spill_error(sheet_pos));

        ops.push(Operation::SetSpill {
            spill_rect: sheet_pos.into(),
            code_cell_sheet_pos: Some(sheet_pos),
        });

        ops
    }

    /// Creates operations to delete code_cell and code_cell_run, releases related Spills, and releases any SpillErrors
    pub fn delete_code_cell_operations(&self, sheet_pos: SheetPos) -> Vec<Operation> {
        let sheet = match self.grid.try_sheet_from_id(sheet_pos.sheet_id) {
            None => return vec![], // sheet may have been deleted in multiplayer
            Some(sheet) => sheet,
        };

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
                // todo...
                // self.check_spill_release_operations(sheet_pos);
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
                });
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
        let sheet = match self.grid.try_sheet_from_id(sheet_pos.sheet_id) {
            None => return vec![], // sheet may have been deleted in multiplayer
            Some(sheet) => sheet,
        };
        let pos = sheet_pos.into();
        let old_run = sheet.set_code_cell_run(pos, code_cell_run);

        let mut ops = vec![];

        ops.push(Operation::SetCodeCellRun {
            sheet_pos,
            code_cell_run,
        });
        ops
    }

    pub fn check_for_spill_error_release(
        &self,
        sheet_rect: SheetRect,
        added_cell_values: Option<SheetPos>,
    ) -> Vec<Operation> {
        // match self.grid.try_sheet_from_id(sheet_rect.sheet_id) {
        //     None => vec![], // sheet may have been deleted in multiplayer
        //     Some(sheet) => {
        //         let mut ops = vec![];
        //         if let Some((sheet_pos, run)) = sheet.code_cell_runs.iter().find(|(pos, run)| {
        //             if run.spill_error && run.output_origin_rect().translate(*pos).contains(sheet_rect) {
        //                 if let Some(added_cell_values) = added_cell_values {
        //                     // if the spill error was caused by the added cell_values then don't release it
        //                     !run.output_origin_rect().translate(*pos).contains(added_cell_values)
        //                 } else {
        //                     true
        //                 }
        //             } else {
        //                 false
        //             }
        //             let mut run = run.clone();
        //             run.spill_error = false;
        //             ops.push(Operation::SetCodeCellRun {
        //                 sheet_pos: sheet_pos.to_sheet_pos(sheet_rect.sheet_id),
        //                 code_cell_run: Some(run),
        //             });
        //         }
        //         ops
        //     }
        // }
        vec![]
    }

    /// Checks whether setting a cell_value will cause a spill_error.
    /// if so then it returns the operations to set the spill_error.
    pub fn check_for_cell_value_spill_error(&self, sheet_pos: SheetPos) -> Vec<Operation> {
        match self.grid.try_sheet_from_id(sheet_pos.sheet_id) {
            None => vec![], // sheet may have been deleted in multiplayer
            Some(sheet) => {
                let mut ops = vec![];
                if let Some((code_cell_sheet_pos, run)) = sheet
                    .code_cell_runs
                    .iter()
                    .find(|(code_cell_pos, run)| {
                        !run.spill_error
                            && run
                                .output_sheet_rect(code_cell_pos.to_sheet_pos(sheet_pos.sheet_id))
                                .contains(sheet_pos)
                    })
                    .map(|(code_cell_pos, run)| (code_cell_pos.to_sheet_pos(sheet.id), run.clone()))
                {
                    let mut run = run.clone();
                    run.spill_error = true;
                    ops.push(Operation::SetCodeCellRun {
                        sheet_pos: code_cell_sheet_pos,
                        code_cell_run: Some(run),
                    });
                    let output_rect = run.output_sheet_rect(code_cell_sheet_pos);
                    ops.extend(self.check_for_spill_error_release(output_rect, Some(sheet_pos)));
                }
                ops
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_code_cell_operations() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos::new(sheet_id, 0, 0);
        let ops = gc.set_code_cell_operations(
            sheet_pos,
            CodeCellLanguage::Python,
            String::from("print('hello')"),
        );
        assert_eq!(ops.len(), 3);
        assert_eq!(
            ops[0],
            Operation::SetCellValues {
                sheet_rect: SheetRect::from(sheet_pos),
                values: Array::from(CellValue::Blank),
            }
        );
        assert_eq!(
            ops[1],
            Operation::SetCodeCell {
                sheet_pos,
                code_cell_value: Some(CodeCell {
                    language: CodeCellLanguage::Python,
                    code_string: String::from("print('hello')"),
                    formatted_code_string: None,
                    last_modified: date_string(),
                }),
            }
        );
        assert_eq!(
            ops[2],
            Operation::SetSpill {
                spill_rect: SheetRect::from(sheet_pos),
                code_cell_sheet_pos: Some(sheet_pos),
            }
        );
    }
}
