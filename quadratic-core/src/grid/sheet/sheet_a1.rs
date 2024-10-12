use crate::{grid::GridBounds, A1Cells, A1CellsType, Rect};

use super::Sheet;

impl Sheet {
    /// Turns an A1Cells request into a Rect.
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
                let y0 = 1;
                let mut y1 = 0;
                columns.iter().for_each(|col| {
                    if let Some((_, max)) = self.column_bounds(*col as i64, true) {
                        y1 = y1.max(max as u64);
                    }
                });
                if y1 != 0 {
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
                let x0 = 1;
                let mut x1 = 0;
                rows.iter().for_each(|row| {
                    if let Some((_, max)) = self.row_bounds(*row as i64, true) {
                        x1 = x1.max(max as u64);
                    }
                });
                if x1 != 0 {
                    Some(Rect::new(x0 as i64, *y0 as i64, x1 as i64, *y1 as i64))
                } else {
                    None
                }
            }
            A1CellsType::Rect(rect) => Some(rect),
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;
    use crate::{A1CellsType, CellValue};

    #[test]
    #[parallel]
    fn test_a1_cells_rect_all() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((1, 1).into(), CellValue::Text("1".to_string()));
        sheet.set_cell_value((2, 3).into(), CellValue::Text("2".to_string()));
        sheet.calculate_bounds();
        let all_cells = A1Cells {
            cells: A1CellsType::All,
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
            cells: A1CellsType::Columns(vec![1, 2, 5]),
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
            cells: A1CellsType::Rows(vec![1, 3, 5]),
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
            cells: A1CellsType::All,
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
            cells: A1CellsType::Rect(specific_rect),
            sheet_name: None,
        };
        assert_eq!(sheet.a1_cells_rect(rect_cells), Some(specific_rect));
    }
}
