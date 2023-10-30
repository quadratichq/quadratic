use crate::grid::borders::{get_render_horizontal_borders, get_render_vertical_borders};
use crate::{
    grid::{
        js_types::{
            JsRenderBorder, JsRenderCell, JsRenderCodeCell, JsRenderCodeCellState, JsRenderFill,
        },
        CodeCellRunResult, NumericFormatKind,
    },
    Pos, Rect,
};

use super::Sheet;

impl Sheet {
    /// checks columns for any column that has data that might render
    pub fn has_render_cells(&self, region: Rect) -> bool {
        self.columns.range(region.x_range()).any(|(_, column)| {
            column.values.has_blocks_in_range(region.y_range())
                || column.spills.has_blocks_in_range(region.y_range())
        })
    }

    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    pub fn get_render_cells(&self, rect: Rect) -> Vec<JsRenderCell> {
        let mut render_cells = vec![];
        rect.x_range().for_each(|x| {
            let column = self.get_column(x);
            rect.y_range().for_each(|y| {
                if let Some(column) = column {
                    // first check if there a column.values
                    if let Some(value) = column.values.get(y) {
                        let (numeric_format, numeric_decimal) = if value.type_name() == "number" {
                            let numeric_format = column.numeric_format.get(y);
                            let is_percentage = if let Some(numeric_format) = numeric_format.clone()
                            {
                                numeric_format.kind == NumericFormatKind::Percentage
                            } else {
                                false
                            };
                            let numeric_decimals = self.decimal_places(Pos { x, y }, is_percentage);
                            (numeric_format, numeric_decimals)
                        } else {
                            (None, None)
                        };
                        render_cells.push(JsRenderCell {
                            x,
                            y,
                            value: value.to_display(numeric_format, numeric_decimal),
                            language: None,
                            align: column.align.get(y),
                            wrap: column.wrap.get(y),
                            bold: column.bold.get(y),
                            italic: column.italic.get(y),
                            text_color: column.text_color.get(y),
                        });
                    }
                    // next check if there a spills value
                    else if let Some(cell_ref) = column.spills.get(y) {
                        if let Some(code_cell) = self.code_cells.get(&cell_ref) {
                            if let Some(pos) = self.cell_ref_to_pos(cell_ref) {
                                if code_cell.get_error().is_some() {
                                    // only show the error in the first cell
                                    if pos.x == x && pos.y == y {
                                        render_cells.push(JsRenderCell {
                                            x,
                                            y,
                                            value: String::from(" ERROR"),
                                            language: Some(code_cell.language),
                                            align: None,
                                            wrap: None,
                                            bold: None,
                                            italic: Some(true),
                                            text_color: Some(String::from("red")),
                                        });
                                    }
                                }
                                // otherwise we need to render the value within the code cell's results
                                else {
                                    // language is only shown on the first cell
                                    let language = if pos.x == x && pos.y == y {
                                        Some(code_cell.language)
                                    } else {
                                        None
                                    };
                                    if let Some(value) = code_cell
                                        .get_output_value((x - pos.x) as u32, (y - pos.y) as u32)
                                    {
                                        let (numeric_format, numeric_decimal) = if value.type_name()
                                            == "number"
                                        {
                                            let numeric_format = column.numeric_format.get(y);
                                            let is_percentage = if let Some(numeric_format) =
                                                numeric_format.clone()
                                            {
                                                numeric_format.kind == NumericFormatKind::Percentage
                                            } else {
                                                false
                                            };
                                            let numeric_decimals =
                                                self.decimal_places(Pos { x, y }, is_percentage);
                                            (numeric_format, numeric_decimals)
                                        } else {
                                            (None, None)
                                        };
                                        render_cells.push(JsRenderCell {
                                            x,
                                            y,
                                            value: value
                                                .to_display(numeric_format, numeric_decimal),
                                            language,
                                            align: column.align.get(y),
                                            wrap: column.wrap.get(y),
                                            bold: column.bold.get(y),
                                            italic: column.italic.get(y),
                                            text_color: column.text_color.get(y),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            });
        });
        render_cells
    }

    /// Returns all data for rendering cell fill color.
    pub fn get_all_render_fills(&self) -> Vec<JsRenderFill> {
        let mut ret = vec![];
        for (&x, column) in self.columns.iter() {
            for block in column.fill_color.blocks() {
                ret.push(JsRenderFill {
                    x,
                    y: block.y,
                    w: 1,
                    h: block.len() as u32,
                    color: block.content().value.clone(),
                });
            }
        }
        ret
    }
    /// Returns data for rendering cell fill color.
    pub fn get_render_fills(&self, region: Rect) -> Vec<JsRenderFill> {
        let mut ret = vec![];
        for (&x, column) in self.columns.range(region.x_range()) {
            for block in column.fill_color.blocks_covering_range(region.y_range()) {
                ret.push(JsRenderFill {
                    x,
                    y: block.y,
                    w: 1,
                    h: block.len() as u32,
                    color: block.content().value.clone(),
                });
            }
        }
        ret
    }
    /// Returns data for rendering code cells.
    pub fn get_render_code_cells(&self, rect: Rect) -> Vec<JsRenderCodeCell> {
        self.iter_code_cells_locations_in_region(rect)
            .filter_map(|cell_ref| {
                let pos = self.cell_ref_to_pos(cell_ref)?;
                if !rect.contains(pos) {
                    return None;
                }
                let code_cell = self.code_cells.get(&cell_ref)?;
                let output_size = code_cell.output_size();
                let state = match &code_cell.output {
                    Some(output) => match output.result {
                        CodeCellRunResult::Ok { .. } => JsRenderCodeCellState::Success,
                        CodeCellRunResult::Err { .. } => JsRenderCodeCellState::RunError,
                    },
                    None => JsRenderCodeCellState::NotYetRun,
                };
                Some(JsRenderCodeCell {
                    x: pos.x,
                    y: pos.y,
                    w: output_size.w.get(),
                    h: output_size.h.get(),
                    language: code_cell.language,
                    state,
                })
            })
            .collect()
    }

    /// Returns data for all rendering code cells
    pub fn get_all_render_code_cells(&self) -> Vec<JsRenderCodeCell> {
        self.iter_code_cells_locations()
            .filter_map(|cell_ref| {
                let pos = self.cell_ref_to_pos(cell_ref)?;
                let code_cell = self.code_cells.get(&cell_ref)?;
                let output_size = code_cell.output_size();
                Some(JsRenderCodeCell {
                    x: pos.x,
                    y: pos.y,
                    w: output_size.w.get(),
                    h: output_size.h.get(),
                    language: code_cell.language,
                    state: match &code_cell.output {
                        Some(output) => match &output.result {
                            CodeCellRunResult::Ok { .. } => JsRenderCodeCellState::Success,
                            CodeCellRunResult::Err { .. } => JsRenderCodeCellState::RunError,
                        },
                        None => JsRenderCodeCellState::NotYetRun,
                    },
                })
            })
            .collect()
    }

    /// Returns data for rendering horizontal borders.
    pub fn get_render_horizontal_borders(&self) -> Vec<JsRenderBorder> {
        get_render_horizontal_borders(self)
    }

    /// Returns data for rendering vertical borders.
    pub fn get_render_vertical_borders(&self) -> Vec<JsRenderBorder> {
        get_render_vertical_borders(self)
    }
}
