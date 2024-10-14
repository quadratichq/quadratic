use crate::{grid::GridBounds, A1Cells, A1RangeType, Rect};

use super::Sheet;

impl Sheet {
    /// Turns an A1Cells request into a Rect.
    pub fn a1_cells_rect(&self, a1: A1Cells) -> Option<Rect> {
        match a1.cells {
            A1RangeType::All => match self.bounds(true) {
                GridBounds::Empty => None,
                GridBounds::NonEmpty(bounds) => Some(bounds),
            },
            A1RangeType::Column(column) => self
                .column_bounds(column.index as i64, true)
                .map(|(_, y1)| Rect::new(column.index as i64, 1, column.index as i64, y1)),
            A1RangeType::ColumnRange(columns) => {
                // todo: might want to shrink the rectangle if there is no
                // content at the front or back of the column range
                let x0 = columns.min.index as i64;
                let x1 = columns.max.index as i64;
                let y0 = 1;
                let mut y1 = 0;
                columns.iter().for_each(|col| {
                    if let Some((_, max)) = self.column_bounds(col as i64, true) {
                        y1 = y1.max(max as u64);
                    }
                });
                if y1 != 0 {
                    Some(Rect::new(x0, y0 as i64, x1, y1 as i64))
                } else {
                    None
                }
            }
            A1RangeType::Row(row) => self
                .row_bounds(row.index as i64, true)
                .map(|(_, x1)| Rect::new(1, row.index as i64, x1, row.index as i64)),
            A1RangeType::RowRange(rows) => {
                // todo: might want to shrink the rectangle if there is no
                // content at the front or back of the row range
                let y0 = rows.min.index as i64;
                let y1 = rows.max.index as i64;
                let x0 = 1;
                let mut x1 = 0;
                rows.iter().for_each(|row| {
                    if let Some((_, max)) = self.row_bounds(row as i64, true) {
                        x1 = x1.max(max as u64);
                    }
                });
                if x1 != 0 {
                    Some(Rect::new(x0 as i64, y0 as i64, x1 as i64, y1 as i64))
                } else {
                    None
                }
            }
            A1RangeType::Rect(rect) => Some(Rect::new(
                rect.min.x.index as i64,
                rect.min.y.index as i64,
                rect.max.x.index as i64,
                rect.max.y.index as i64,
            )),
            A1RangeType::Pos(pos) => Some(Rect::new(
                pos.x.index as i64,
                pos.y.index as i64,
                pos.x.index as i64,
                pos.y.index as i64,
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;
    use crate::{CellValue, RelColRow, RelColRowRange, RelPos, RelRect};

    #[test]
    #[parallel]
    fn test_a1_cells_rect_all() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((1, 1).into(), CellValue::Text("1".to_string()));
        sheet.set_cell_value((2, 3).into(), CellValue::Text("2".to_string()));
        sheet.calculate_bounds();
        let all_cells = A1Cells {
            cells: A1RangeType::All,
            sheet_name: None,
        };
        assert_eq!(sheet.a1_cells_rect(all_cells), Some(Rect::new(1, 1, 2, 3)));
    }

    #[test]
    #[parallel]
    fn test_a1_cells_rect_columns() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((1, 1).into(), CellValue::Text("1".to_string()));
        sheet.set_cell_value((2, 3).into(), CellValue::Text("2".to_string()));
        sheet.set_cell_value((5, 1).into(), CellValue::Text("3".to_string()));
        sheet.calculate_bounds();
        let columns = A1Cells {
            cells: A1RangeType::ColumnRange(RelColRowRange {
                min: RelColRow {
                    index: 1,
                    relative: true,
                },
                max: RelColRow {
                    index: 5,
                    relative: true,
                },
            }),
            sheet_name: None,
        };
        assert_eq!(sheet.a1_cells_rect(columns), Some(Rect::new(1, 1, 5, 3)));
    }

    #[test]
    #[parallel]
    fn test_a1_cells_rect_rows() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((1, 1).into(), CellValue::Text("1".to_string()));
        sheet.set_cell_value((2, 3).into(), CellValue::Text("2".to_string()));
        sheet.set_cell_value((1, 5).into(), CellValue::Text("4".to_string()));
        sheet.calculate_bounds();
        let rows = A1Cells {
            cells: A1RangeType::RowRange(RelColRowRange {
                min: RelColRow {
                    index: 1,
                    relative: true,
                },
                max: RelColRow {
                    index: 5,
                    relative: true,
                },
            }),
            sheet_name: None,
        };
        assert_eq!(sheet.a1_cells_rect(rows), Some(Rect::new(1, 1, 2, 5)));
    }

    #[test]
    #[parallel]
    fn test_a1_cells_rect_empty() {
        let mut sheet = Sheet::test();
        sheet.calculate_bounds();
        let all_cells = A1Cells {
            cells: A1RangeType::All,
            sheet_name: None,
        };
        assert_eq!(sheet.a1_cells_rect(all_cells), None);
    }

    #[test]
    #[parallel]
    fn test_a1_cells_rect_specific() {
        let mut sheet = Sheet::test();
        sheet.calculate_bounds();
        let specific_rect = Rect::new(1, 2, 3, 4);
        let rect_cells = A1Cells {
            cells: A1RangeType::Rect(RelRect {
                min: RelPos {
                    x: RelColRow {
                        index: 1,
                        relative: true,
                    },
                    y: RelColRow {
                        index: 2,
                        relative: true,
                    },
                },
                max: RelPos {
                    x: RelColRow {
                        index: 3,
                        relative: true,
                    },
                    y: RelColRow {
                        index: 4,
                        relative: true,
                    },
                },
            }),
            sheet_name: None,
        };
        assert_eq!(sheet.a1_cells_rect(rect_cells), Some(specific_rect));
    }
}
