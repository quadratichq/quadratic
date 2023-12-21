use crate::{
    controller::{operations::operation::Operation, GridController},
    formulas::{parse_formula, Ctx},
    grid::{CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    util::date_string,
    SheetPos,
};

impl GridController {
    pub(super) fn run_formula(&mut self, sheet_pos: SheetPos, code_cell: &CodeCellValue) {
        let mut ctx = Ctx::new(self.grid(), sheet_pos);
        match parse_formula(&code_cell.code_string, sheet_pos.into()) {
            Ok(parsed) => {
                match parsed.eval(&mut ctx) {
                    Ok(value) => {
                        self.cells_accessed = ctx.cells_accessed;
                        let code_cell_value = Some(CodeCellValue {
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
                            ..code_cell.clone()
                        });
                        self.operations.insert(
                            0,
                            Operation::SetCodeCell {
                                sheet_pos,
                                code_cell_value,
                            },
                        );
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
