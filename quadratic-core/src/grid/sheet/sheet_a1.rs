use crate::{grid::GridBounds, A1Cells, A1CellsType, Rect};

use super::Sheet;

impl Sheet {
    pub fn a1_cells_rect(&self, a1: A1Cells) -> Option<Rect> {
        match a1.cells {
            A1CellsType::All => match self.bounds(true) {
                GridBounds::Empty => None,
                GridBounds::NonEmpty(bounds) => Some(bounds),
            },
            A1CellsType::Columns(mut columns) => {
                if columns.is_empty() {
                    return None;
                }
                columns.sort();
                let Some(x0) = columns.first() else {
                    return None;
                };
                let Some(x1) = columns.last() else {
                    return None;
                };
                let mut y0 = u64::MAX;
                let mut y1 = 0;
                columns.iter().for_each(|col| {
                    if let Some((min, max)) = self.column_bounds(*col as i64, true) {
                        y0 = y0.min(min as u64);
                        y1 = y1.max(max as u64);
                    }
                });
                if y0 != u64::MAX && y1 != 0 {
                    Some(Rect::new(*x0 as i64, y0 as i64, *x1 as i64, y1 as i64))
                } else {
                    None
                }
            }
            A1CellsType::Rows(mut rows) => {
                if rows.is_empty() {
                    return None;
                }
                rows.sort();
                let Some(y0) = rows.first() else {
                    return None;
                };
                let Some(y1) = rows.last() else {
                    return None;
                };
                let mut x0 = u64::MAX;
                let mut x1 = 0;
                rows.iter().for_each(|row| {
                    if let Some((min, max)) = self.row_bounds(*row as i64, true) {
                        x0 = x0.min(min as u64);
                        x1 = x1.max(max as u64);
                    }
                });
                if x0 != u64::MAX && x1 != 0 {
                    Some(Rect::new(x0 as i64, *y0 as i64, x1 as i64, *y1 as i64))
                } else {
                    None
                }
            }
            A1CellsType::Rect(rect) => Some(rect),
        }
    }
}
