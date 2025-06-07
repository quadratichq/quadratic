use crate::{Pos, Value, grid::Contiguous2D};

use super::DataTable;

impl DataTable {
    /// Iterates through tables and sets empty cells to the empty_cell cache
    pub fn add_empty_cells_to_cache(&self, pos: Pos, cache: &mut Contiguous2D<Option<bool>>) {
        let output_rect = self.output_rect(pos, false);
        match self.value {
            Value::Array(ref array) => {
                let width = output_rect.width() as usize;
                let mut x = 0;
                let mut y = 0;
                array.values_iter().for_each(|cell| {
                    if cell.is_blank_or_empty_string() {
                        cache.set(
                            Pos {
                                x: x as i64 + pos.x,
                                y: y as i64 + pos.y,
                            },
                            Some(true),
                        );
                    }
                    x += 1;
                    if x == width {
                        x = 0;
                        y += 1;
                    }
                });
            }
            _ => {}
        }
    }
}
