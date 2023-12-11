use crate::{
    controller::GridController,
    formulas::{parse_formula, Ctx},
    grid::{CellRef, CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    Pos, SheetPos,
};

impl GridController {
    pub(super) fn eval_formula(
        &mut self,
        code_string: String,
        language: CodeCellLanguage,
        pos: Pos,
        cell_ref: CellRef,
    ) {
        let sheet_id = cell_ref.sheet;
        let mut ctx = Ctx::new(
            self.grid(),
            SheetPos {
                sheet_id,
                x: pos.x,
                y: pos.y,
            },
        );
        match parse_formula(&code_string, pos) {
            Ok(parsed) => {
                match parsed.eval(&mut ctx) {
                    Ok(value) => {
                        self.cells_accessed = ctx
                            .cells_accessed
                            .iter()
                            .map(|sheet_pos| {
                                let sheet = self.grid_mut().sheet_mut_from_id(sheet_pos.sheet_id);
                                let pos = (*sheet_pos).into();
                                let (cell_ref, operations) = sheet.get_or_create_cell_ref(pos);
                                if let Some(operations) = operations {
                                    self.forward_operations.extend(operations);
                                }
                                cell_ref
                            })
                            .collect();

                        let updated_code_cell_value = CodeCellValue {
                            language,
                            code_string,
                            formatted_code_string: None,
                            output: Some(CodeCellRunOutput {
                                std_out: None,
                                std_err: None,
                                result: CodeCellRunResult::Ok {
                                    output_value: value,
                                    cells_accessed: self
                                        .cells_accessed
                                        .clone()
                                        .into_iter()
                                        .collect(),
                                },
                                spill: false,
                            }),
                            // todo
                            last_modified: String::new(),
                        };
                        if self.update_code_cell_value(cell_ref, Some(updated_code_cell_value)) {
                            // clears cells_accessed
                            self.cells_accessed.clear();
                        }
                    }
                    Err(error) => {
                        let msg = error.msg.to_string();
                        let line_number = error.span.map(|span| span.start as i64);
                        self.code_cell_sheet_error(
                            msg,
                            // todo: span should be multiline
                            line_number,
                        );
                    }
                }
            }
            Err(e) => {
                let msg = e.to_string();
                self.code_cell_sheet_error(msg, None);
            }
        }
    }
}
