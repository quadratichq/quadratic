use std::{collections::HashSet, ops::Range};

use itertools::Itertools;

use super::Sheet;
use crate::{
    controller::operations::operation::Operation,
    grid::{CodeCellValue, RenderSize},
    CellValue, Pos, Rect, SheetPos, SheetRect, Value,
};

impl Sheet {
    /// Sets or deletes a code cell value.
    pub fn set_code_cell_value(
        &mut self,
        pos: Pos,
        code_cell: Option<CodeCellValue>,
    ) -> Option<CodeCellValue> {
        let old = self.code_cells.remove(&pos);

        // this column has to exist since it was just created in the previous statement
        let code_cell_column = self.get_or_create_column(pos.x);

        if let Some(code_cell) = code_cell {
            if let Some(output) = &code_cell.output {
                match output.output_value() {
                    Some(output_value) => {
                        match output_value {
                            Value::Single(_) => {
                                code_cell_column.spills.set(pos.y, Some(pos));
                            }
                            Value::Array(array) => {
                                // if spilled only set the top left cell
                                if output.spill {
                                    let column = self.get_or_create_column(pos.x);
                                    column.spills.set(pos.y, Some(pos));
                                }
                                // otherwise set the whole array
                                else {
                                    let start = pos.x;
                                    let end = start + array.width() as i64;
                                    let range = Range {
                                        start: pos.y,
                                        end: pos.y + array.height() as i64,
                                    };
                                    for x in start..end {
                                        let column = self.get_or_create_column(x);
                                        column.spills.set_range(range.clone(), pos);
                                    }
                                }
                            }
                        }
                    }
                    None => {
                        code_cell_column.spills.set(pos.y, Some(pos));
                    }
                }
            } else {
                code_cell_column.spills.set(pos.y, Some(pos));
            }
            self.code_cells.insert(pos, code_cell);
        }
        old
    }

    /// Returns a code cell value.
    pub fn get_code_cell(&self, pos: Pos) -> Option<&CodeCellValue> {
        self.code_cells.get(&pos)
    }

    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        let column = self.get_column(pos.x)?;
        let code_cell_pos = column.spills.get(pos.y)?;
        let code_cell = self.code_cells.get(&code_cell_pos)?;
        code_cell.get_output_value(
            (pos.x - code_cell_pos.x) as u32,
            (pos.y - code_cell_pos.y) as u32,
        )
    }

    /// Get the spill location for a given position.
    pub fn get_spill(&self, pos: Pos) -> Option<Pos> {
        let column = self.get_column(pos.x)?;
        column.spills.get(pos.y)
    }

    /// Sets the spills.
    /// Returns reverse operations
    pub fn set_spills(&mut self, sheet_rect: &SheetRect, spill: Option<Pos>) -> Vec<Operation> {
        let sheet_id = sheet_rect.sheet_id;
        let mut old_values = vec![];

        // check if we're just setting all spills to None to be more efficient
        let mut empty = true;

        for x in sheet_rect.x_range() {
            let column = self.get_or_create_column(x);

            // need to track old spill operations for undo
            for y in sheet_rect.y_range() {
                if let Some(spill) = column.spills.get(y) {
                    empty = false;
                    old_values.push(Operation::SetSpills {
                        spill_rect: SheetRect::from_numbers(x, y, 1, 1, sheet_rect.sheet_id),
                        code_cell_sheet_pos: Some(spill.to_sheet_pos(sheet_id)),
                    });
                } else {
                    old_values.push(Operation::SetSpills {
                        spill_rect: SheetRect::from_numbers(x, y, 1, 1, sheet_rect.sheet_id),
                        code_cell_sheet_pos: None,
                    });
                }
            }
            match spill {
                Some(pos) => column.spills.set_range(sheet_rect.y_range(), pos),
                None => column.spills.remove_range(sheet_rect.y_range()),
            };
        }
        if empty {
            vec![Operation::SetSpills {
                spill_rect: *sheet_rect,
                code_cell_sheet_pos: None,
            }]
        } else {
            old_values
        }
    }

    /// Returns an iterator over all locations containing code cells that may
    /// spill into `region`.
    pub fn iter_code_cells_in_rect(&self, rect: Rect) -> impl Iterator<Item = Pos> {
        let code_cell_positions: HashSet<Pos> = self
            .columns
            .range(rect.x_range())
            .flat_map(|(_x, column)| {
                column
                    .spills
                    .blocks_covering_range(rect.y_range())
                    .map(|block| block.content().value)
            })
            .collect();

        code_cell_positions.into_iter()
    }

    pub fn iter_code_cells_locations(&self) -> impl '_ + Iterator<Item = Pos> {
        self.code_cells.keys().copied()
    }

    /// returns the render-size for a html-like cell
    pub fn render_size(&self, pos: Pos) -> Option<RenderSize> {
        let column = self.get_column(pos.x)?;
        column.render_size.get(pos.y)
    }

    /// Checks if the deletion of a cell or a code_cell released a spill error;
    /// sorted by earliest last_modified.
    /// Returns the Pos and the code_cell_value if it did
    pub fn spill_error_released(&self, sheet_rect: SheetRect) -> Option<(SheetPos, CodeCellValue)> {
        let sheet_id = sheet_rect.sheet_id;
        self.code_cells
            .iter()
            .filter(|(_, code_cell)| code_cell.has_spill_error())
            .sorted_by_key(|a| &a.1.last_modified)
            .filter_map(|(code_cell_pos, code_cell)| {
                // only check code_cells with spill errors
                if !code_cell.has_spill_error() {
                    return None;
                }
                let output_size = code_cell.output_size();
                // cannot spill if only 1x1
                if output_size.len() == 1 {
                    return None;
                }
                sheet_rect
                    .intersects(SheetRect::from_sheet_pos_and_size(
                        code_cell_pos.to_sheet_pos(sheet_id),
                        output_size,
                    ))
                    .then(|| (code_cell_pos.to_sheet_pos(sheet_id), code_cell.to_owned()))
            })
            .next()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{controller::GridController, grid::RenderSize};

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
    fn test_set_spills() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut_from_id(sheet_id).unwrap();
        sheet.set_spills(
            &SheetRect::from_numbers(0, 0, 1, 5, sheet_id),
            Some(Pos { x: 0, y: 0 }),
        );
        let sheet_rect = crate::SheetRect::from_numbers(0, 0, 1, 5, sheet_id);
        let old_values = sheet.set_spills(&sheet_rect, Some(Pos { x: 1, y: 1 }));
        let code_cell_sheet_pos = Some(SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        });
        assert_eq!(
            old_values,
            vec![
                Operation::SetSpills {
                    spill_rect: SheetRect::from_numbers(0, 0, 1, 1, sheet_id),
                    code_cell_sheet_pos: code_cell_sheet_pos.clone(),
                },
                Operation::SetSpills {
                    spill_rect: SheetRect::from_numbers(0, 1, 1, 1, sheet_id),
                    code_cell_sheet_pos: code_cell_sheet_pos.clone(),
                },
                Operation::SetSpills {
                    spill_rect: SheetRect::from_numbers(0, 2, 1, 1, sheet_id),
                    code_cell_sheet_pos: code_cell_sheet_pos.clone(),
                },
                Operation::SetSpills {
                    spill_rect: SheetRect::from_numbers(0, 3, 1, 1, sheet_id),
                    code_cell_sheet_pos: code_cell_sheet_pos.clone(),
                },
                Operation::SetSpills {
                    spill_rect: SheetRect::from_numbers(0, 4, 1, 1, sheet_id),
                    code_cell_sheet_pos: code_cell_sheet_pos.clone(),
                },
            ]
        );
        assert_eq!(
            sheet.get_spill(Pos { x: 0, y: 0 }),
            Some(Pos { x: 1, y: 1 })
        );

        // if setting empty spills, return a single SetSpills operation
        let sheet_rect = SheetRect {
            min: Pos { x: 100, y: 0 },
            max: Pos { x: 200, y: 100 },
            sheet_id,
        };
        let old_values = sheet.set_spills(&sheet_rect, Some(Pos { x: 2, y: 2 }));
        assert_eq!(
            old_values,
            vec![Operation::SetSpills {
                spill_rect: sheet_rect,
                code_cell_sheet_pos: None,
            }]
        );
    }
}
