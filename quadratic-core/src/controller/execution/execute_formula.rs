use crate::{
    controller::{operations::operation::Operation, GridController},
    formulas::{parse_formula, Ctx},
    grid::{CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    util::date_string,
    SheetPos,
};

impl GridController {
    pub(super) fn execute_formula(&mut self, sheet_pos: SheetPos, code_cell: &CodeCellValue) {
        let mut ctx = Ctx::new(self.grid(), sheet_pos);
        match parse_formula(&code_cell.code_string, sheet_pos.into()) {
            Ok(parsed) => {
                match parsed.eval(&mut ctx) {
                    Ok(value) => {
                        self.cells_accessed = ctx.cells_accessed;
                        self.operations.insert(
                            0,
                            Operation::Check
                        )
                        self.operations.insert(
                            0,
                            Operation::SetCodeCellRun {
                                sheet_pos,
                                last_modified: date_string(),
                                code_cell_run: Some(CodeCellRunOutput {
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
