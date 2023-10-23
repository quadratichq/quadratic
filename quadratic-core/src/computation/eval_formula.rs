use crate::{
    controller::GridController,
    formulas::{parse_formula, Ctx},
    grid::{
        CellRef, CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue, SheetId,
    },
    Pos, SheetPos,
};

use crate::controller::code_cell_update::update_code_cell_value;

use super::TransactionInProgress;

impl TransactionInProgress {
    pub(super) fn eval_formula(
        &mut self,
        grid_controller: &mut GridController,
        code_string: String,
        language: CodeCellLanguage,
        pos: Pos,
        cell_ref: CellRef,
        sheet_id: SheetId,
    ) {
        let mut ctx = Ctx::new(
            grid_controller.grid(),
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
                        let updated_code_cell_value = CodeCellValue {
                            language,
                            code_string,
                            formatted_code_string: None,
                            output: Some(CodeCellRunOutput {
                                std_out: None,
                                std_err: None,
                                result: CodeCellRunResult::Ok {
                                    output_value: value,
                                    cells_accessed: ctx
                                        .cells_accessed
                                        .iter()
                                        .map(|sheet_pos| {
                                            let sheet = grid_controller
                                                .grid_mut()
                                                .sheet_mut_from_id(sheet_pos.sheet_id);
                                            let pos = (*sheet_pos).into();
                                            sheet.get_or_create_cell_ref(pos)
                                        })
                                        .collect(),
                                },
                            }),
                            // todo
                            last_modified: String::new(),
                        };
                        update_code_cell_value(
                            grid_controller,
                            cell_ref,
                            Some(updated_code_cell_value),
                            &mut Some(&mut self.cells_to_compute),
                            &mut self.reverse_operations,
                            &mut self.summary,
                        );
                    }
                    Err(error) => {
                        let msg = error.msg.to_string();
                        let line_number = if let Some(span) = error.span {
                            Some(span.start as i64)
                        } else {
                            None
                        };
                        self.code_cell_sheet_error(
                            grid_controller,
                            msg,
                            // todo: span should be multiline
                            line_number,
                        );
                    }
                }
            }
            Err(e) => {
                let msg = e.to_string();
                self.code_cell_sheet_error(grid_controller, msg, None);
            }
        }
    }
}
