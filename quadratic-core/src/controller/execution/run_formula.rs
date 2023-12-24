use crate::{
    controller::GridController,
    formulas::{parse_formula, Ctx},
    grid::{CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    util::date_string,
    SheetPos,
};

impl GridController {
    pub(super) fn run_formula(&mut self, sheet_pos: SheetPos, old_code_cell: &CodeCellValue) {
        let mut ctx = Ctx::new(self.grid(), sheet_pos);
        match parse_formula(&old_code_cell.code_string, sheet_pos.into()) {
            Ok(parsed) => {
                match parsed.eval(&mut ctx) {
                    Ok(value) => {
                        self.cells_accessed = ctx.cells_accessed;
                        let new_code_cell_value = CodeCellValue {
                            last_modified: date_string(),
                            output: Some(CodeCellRunOutput {
                                std_out: None,
                                std_err: None,
                                result: CodeCellRunResult::Ok {
                                    output_value: value,
                                    cells_accessed: self.cells_accessed.clone(),
                                },
                                spill: false,
                            }),
                            ..old_code_cell.clone()
                        };
                        self.add_code_cell_operations(
                            sheet_pos,
                            Some(old_code_cell),
                            Some(&new_code_cell_value),
                        );
                        if let Some(sheet) = self.grid.try_sheet_mut_from_id(sheet_pos.sheet_id) {
                            sheet.set_code_cell(sheet_pos.into(), Some(new_code_cell_value));
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
