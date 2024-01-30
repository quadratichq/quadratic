use super::Sheet;
use crate::{
    grid::{js_types::JsCodeCell, CodeRun, RenderSize},
    CellValue, Pos, Rect,
};

impl Sheet {
    /// Sets or deletes a code run.
    ///
    /// Returns the old value if it was set.
    pub fn set_code_run(&mut self, pos: Pos, code_run: Option<CodeRun>) -> Option<CodeRun> {
        if let Some(code_run) = code_run {
            self.code_runs.insert(pos, code_run)
        } else {
            self.code_runs.remove(&pos)
        }
    }

    /// Returns a CodeCell at a Pos
    pub fn code_run(&self, pos: Pos) -> Option<&CodeRun> {
        self.code_runs.get(&pos)
    }

    /// Returns the CellValue for a CodeRun (if it exists) at the Pos.
    ///
    /// Note: spill error will return a CellValue::Blank to ensure calculations can continue.
    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        self.code_runs.iter().find_map(|(code_cell_pos, code_run)| {
            if code_run.output_rect(*code_cell_pos, false).contains(pos) {
                code_run.cell_value_at(
                    (pos.x - code_cell_pos.x) as u32,
                    (pos.y - code_cell_pos.y) as u32,
                )
            } else {
                None
            }
        })
    }

    pub fn iter_code_output_in_rect(&self, rect: Rect) -> impl Iterator<Item = (Rect, &CodeRun)> {
        self.code_runs
            .iter()
            .filter_map(move |(pos, code_cell_value)| {
                let output_rect = code_cell_value.output_rect(*pos, false);
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

    /// Returns whether a rect overlaps the output of a code cell.
    /// It will only check code_cells until it finds the code_run at code_pos (since later code_runs do not cause spills in earlier ones)
    pub fn has_code_cell_in_rect(&self, rect: &Rect, code_pos: Pos) -> bool {
        for (pos, code_run) in &self.code_runs {
            if pos == &code_pos {
                // once we reach the code_cell, we can stop checking
                return false;
            }
            if code_run.output_rect(*pos, false).intersects(*rect) {
                return true;
            }
        }
        false
    }

    /// Returns the code cell at a Pos; also returns the code cell if the Pos is part of a code run.
    /// Used for double clicking a cell on the grid.
    pub fn edit_code_value(&self, pos: Pos) -> Option<JsCodeCell> {
        let mut code_pos = pos;
        let code_cell = if let Some(cell_value) = self.cell_value(pos) {
            Some(cell_value)
        } else {
            self.code_runs.iter().find_map(|(code_cell_pos, code_run)| {
                if code_run.output_rect(*code_cell_pos, false).contains(pos) {
                    if let Some(code_value) = self.cell_value(*code_cell_pos) {
                        code_pos = *code_cell_pos;
                        Some(code_value)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
        };

        let Some(code_cell) = code_cell else {
            return None;
        };

        match code_cell {
            CellValue::Code(code_cell) => {
                if let Some(code_run) = self.code_run(code_pos) {
                    let evaluation_result =
                        serde_json::to_string(&code_run.result).unwrap_or("".to_string());
                    let spill_error = if code_run.spill_error {
                        Some(self.find_spill_error_reasons(
                            &code_run.output_rect(code_pos, true),
                            code_pos,
                        ))
                    } else {
                        None
                    };
                    Some(JsCodeCell {
                        x: code_pos.x,
                        y: code_pos.y,
                        code_string: code_cell.code,
                        language: code_cell.language,
                        std_err: code_run.std_err.clone(),
                        std_out: code_run.std_out.clone(),
                        evaluation_result: Some(evaluation_result),
                        spill_error,
                    })
                } else {
                    Some(JsCodeCell {
                        x: code_pos.x,
                        y: code_pos.y,
                        code_string: code_cell.code,
                        language: code_cell.language,
                        std_err: None,
                        std_out: None,
                        evaluation_result: None,
                        spill_error: None,
                    })
                }
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        controller::GridController,
        grid::{js_types::JsRenderCellSpecial, CodeCellLanguage, CodeRunResult, RenderSize},
        Array, CodeCellValue, SheetPos, Value,
    };
    use bigdecimal::BigDecimal;
    use chrono::Utc;
    use std::collections::HashSet;

    #[test]
    fn test_render_size() {
        use crate::Pos;

        let mut gc = GridController::test();
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
    fn test_set_code_run() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();
        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Number(BigDecimal::from(2)))),
            spill_error: false,
        };
        let old = sheet.set_code_run(Pos { x: 0, y: 0 }, Some(code_run.clone()));
        assert_eq!(old, None);
        assert_eq!(sheet.code_run(Pos { x: 0, y: 0 }), Some(&code_run));
        assert_eq!(sheet.code_run(Pos { x: 0, y: 0 }), Some(&code_run));
        assert_eq!(sheet.code_run(Pos { x: 1, y: 0 }), None);
    }

    #[test]
    fn test_get_code_run() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Number(BigDecimal::from(2)))),
            spill_error: false,
            last_modified: Utc::now(),
        };
        sheet.set_code_run(Pos { x: 0, y: 0 }, Some(code_run.clone()));
        assert_eq!(
            sheet.get_code_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(sheet.code_run(Pos { x: 0, y: 0 }), Some(&code_run));
        assert_eq!(sheet.code_run(Pos { x: 1, y: 1 }), None);
    }

    #[test]
    fn test_edit_code_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(
            Pos { x: 0, y: 0 },
            CellValue::Code(CodeCellValue {
                code: "=".to_string(),
                language: CodeCellLanguage::Formula,
            }),
        );
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Array(Array::from(vec![vec!["1", "2", "3"]]))),
            spill_error: false,
            last_modified: Utc::now(),
        };
        sheet.set_code_run(Pos { x: 0, y: 0 }, Some(code_run.clone()));
        assert_eq!(
            sheet.edit_code_value(Pos { x: 0, y: 0 }),
            Some(JsCodeCell {
                x: 0,
                y: 0,
                code_string: "=".to_string(),
                language: CodeCellLanguage::Formula,
                std_err: None,
                std_out: None,
                evaluation_result: Some("{\"size\":{\"w\":3,\"h\":1},\"values\":[{\"type\":\"text\",\"value\":\"1\"},{\"type\":\"text\",\"value\":\"2\"},{\"type\":\"text\",\"value\":\"3\"}]}".to_string()),
                spill_error: None,
            })
        );
        assert_eq!(
            sheet.edit_code_value(Pos { x: 1, y: 0 }),
            Some(JsCodeCell {
                x: 0,
                y: 0,
                code_string: "=".to_string(),
                language: CodeCellLanguage::Formula,
                std_err: None,
                std_out: None,
                evaluation_result: Some("{\"size\":{\"w\":3,\"h\":1},\"values\":[{\"type\":\"text\",\"value\":\"1\"},{\"type\":\"text\",\"value\":\"2\"},{\"type\":\"text\",\"value\":\"3\"}]}".to_string()),
                spill_error: None,
            })
        );
        assert_eq!(sheet.edit_code_value(Pos { x: 2, y: 2 }), None);
    }

    #[test]
    fn edit_code_value_spill() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "should cause spill".into(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3}".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 0 }),
            Some("should cause spill".into())
        );
        let render = sheet.get_render_cells(Rect::from_numbers(0, 0, 1, 1));
        assert_eq!(render[0].special, Some(JsRenderCellSpecial::SpillError));
        let code = sheet.edit_code_value(Pos { x: 0, y: 0 }).unwrap();
        assert_eq!(code.spill_error, Some(vec![Pos { x: 1, y: 0 }]));
    }
}
