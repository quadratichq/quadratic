use super::Sheet;
use crate::{
    grid::{CodeCellRunOutput, CodeCellRunResult, CodeRun, RenderSize},
    CellValue, Pos, Rect,
};

impl Sheet {
    /// Sets or deletes a code run.
    pub fn set_code_run(
        &mut self,
        pos: Pos,
        code_run: Option<CodeCellRunResult>,
    ) -> Option<CodeCellRunResult> {
        let old = self.code_runs
        // todo: probably a more rust-y way to do this
        let old = self
            .code_runs
            .iter()
            .find_map(|(code_cell_pos, code_cell_value)| {
                if *code_cell_pos == pos {
                    Some(code_cell_value)
                } else {
                    None
                }
            })
            .cloned();
        if old.is_some() {
            self.code_runs
                .retain(|code_cell_pos, _| *code_cell_pos != pos);
        }
        if let Some(code_cell) = code_run {
            self.code_runs.insert(pos, code_cell);
        }
        // }
        old
    }

    /// Returns a code_cell at a Pos, including its output (if any).
    pub fn get_code_cell(&self, pos: Pos) -> Option<(&CellValue, Option<&CodeCellRunOutput>)> {
        let code_cell = self.get_cell_value(pos)?;
        if code_cell.is_code() {
            let output = self.code_runs.get(&pos);
            Some((code_cell, output))
        } else {
            None
        }
        self.code_runs
            .iter()
            .find_map(|(code_cell_pos, code_cell_value)| {
                if *code_cell_pos == pos {
                    Some(code_cell_value)
                } else {
                    None
                }
            })
    }

    /// Returns the value for a cell checking first column.values and then code_cell output.
    /// Note: spill error will return a CellValue::Blank to ensure calculations can continue.
    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        self.code_runs
            .iter()
            .find_map(|(code_cell_pos, code_cell_value)| {
                let output_rect = code_cell_value.output_rect(*code_cell_pos);
                if output_rect.contains(pos) {
                    if code_cell_value.has_spill_error() {
                        Some(CellValue::Blank)
                    } else if code_cell_value.get_error().is_some() {
                        if pos.x - code_cell_pos.x == 0 && pos.y - code_cell_pos.y == 0 {
                            Some(CellValue::Blank)
                        } else {
                            None
                        }
                    } else {
                        code_cell_value.get_output_value(
                            (pos.x - code_cell_pos.x) as u32,
                            (pos.y - code_cell_pos.y) as u32,
                        )
                    }
                } else {
                    None
                }
            })
    }

    pub fn iter_code_output_in_rect(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, &CodeRun)> {
        self.code_runs
            .iter()
            .filter_map(move |(pos, code_cell_value)| {
                let output_rect = code_cell_value.output_rect(*pos);
                output_rect
                    .intersects(rect)
                    .then_some((output_rect, code_cell_value))
            })
    }

    /// returns the render-size for a html-like cell
    pub fn render_size(&self, pos: Pos) -> Option<RenderSize> {
        let column = self.get_column(pos.x)?;
        column.render_size.get(pos.y)
    }

    /// Returns whether a rect has a code_cell anchor (ie, the cell with the code) of any code_cell within it.
    /// This needs to be checked regardless of ordering.
    pub fn has_code_cell_anchor_in_rect(&self, rect: &Rect, skip: Pos) -> bool {
        self.code_runs
            .iter()
            .any(|(pos, _)| *pos != skip && rect.contains(*pos))
    }

    /// Returns whether a rect overlaps the output of a code cell.
    /// It will only check code_cells until it finds the code_cell_search since later code_cells don't cause spills in earlier ones.
    pub fn has_code_cell_in_rect(&self, rect: &Rect, skip: Pos) -> bool {
        self.code_runs.iter().any(|(pos, code_cell)| {
            if skip == *pos {
                false
            } else {
                code_cell.output_rect(*pos).intersects(*rect)
            }
        })
    }
}

#[cfg(test)]
mod test {
    use bigdecimal::BigDecimal;

    use super::*;
    use crate::{
        controller::GridController,
        grid::{CodeCellLanguage, RenderSize},
        SheetPos, Value,
    };

    #[test]
    fn test_render_size() {
        use crate::Pos;

        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_render_size(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            }
            .into(),
            Some(crate::grid::RenderSize {
                w: "10".to_string(),
                h: "20".to_string(),
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.render_size(Pos { x: 0, y: 0 }),
            Some(RenderSize {
                w: "10".to_string(),
                h: "20".to_string()
            })
        );
        assert_eq!(sheet.render_size(Pos { x: 1, y: 1 }), None);
    }

    #[test]
    fn test_set_code_cell_value() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut_from_id(sheet_id).unwrap();
        let code_cell_value = CodeRun {
            language: CodeCellLanguage::Formula,
            code_string: "1".to_string(),
            formatted_code_string: None,
            output: None,
            last_modified: "".to_string(),
        };
        let old = sheet.set_code_result(Pos { x: 0, y: 0 }, Some(code_cell_value.clone()));
        assert_eq!(
            sheet.get_code_cell(Pos { x: 0, y: 0 }),
            Some(&code_cell_value)
        );
        assert_eq!(old, None);
        let old = sheet.set_code_result(Pos { x: 0, y: 0 }, None);
        assert_eq!(old, Some(code_cell_value));
        assert_eq!(sheet.get_code_cell(Pos { x: 0, y: 0 }), None);
    }

    #[test]
    fn test_get_code_cell_value() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut_from_id(sheet_id).unwrap();
        let code_cell_value = CodeRun {
            language: CodeCellLanguage::Formula,
            code_string: "1 + 1".to_string(),
            formatted_code_string: None,
            output: Some(crate::grid::CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: crate::grid::CodeCellRunResult::Ok {
                    output_value: Value::Single(CellValue::Number(BigDecimal::from(2))),
                    cells_accessed: std::collections::HashSet::new(),
                },
                spill: false,
            }),
            last_modified: "".to_string(),
        };
        sheet.set_code_result(Pos { x: 0, y: 0 }, Some(code_cell_value.clone()));
        assert_eq!(
            sheet.get_code_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(sheet.get_code_cell_value(Pos { x: 1, y: 1 }), None);
    }
}
