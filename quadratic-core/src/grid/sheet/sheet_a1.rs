use crate::{grid::GridBounds, CellRefRange, CellRefRequest, Rect};

use super::Sheet;

impl Sheet {
    /// Resolves a cell reference to a `Rect`.
    pub fn resolve_cell_ref(&self, cell_ref: CellRefRange) -> Option<Rect> {
        todo!("resolve reference")

        // match a1.cells {
        //     A1RangeType::All => match self.bounds(true) {
        //         GridBounds::Empty => None,
        //         GridBounds::NonEmpty(bounds) => Some(bounds),
        //     },
        //     A1RangeType::Column(column) => self
        //         .column_bounds(column.index as i64, true)
        //         .map(|(_, y1)| Rect::new(column.index as i64, 1, column.index as i64, y1)),
        //     A1RangeType::ColumnRange(columns) => {
        //         // todo: might want to shrink the rectangle if there is no
        //         // content at the front or back of the column range
        //         let x0 = columns.min.index as i64;
        //         let x1 = columns.max.index as i64;
        //         let y0 = 1;
        //         let mut y1 = 0;
        //         columns.iter().for_each(|col| {
        //             if let Some((_, max)) = self.column_bounds(col as i64, true) {
        //                 y1 = y1.max(max as u64);
        //             }
        //         });
        //         if y1 != 0 {
        //             Some(Rect::new(x0, y0 as i64, x1, y1 as i64))
        //         } else {
        //             None
        //         }
        //     }
        //     A1RangeType::Row(row) => self
        //         .row_bounds(row.index as i64, true)
        //         .map(|(_, x1)| Rect::new(1, row.index as i64, x1, row.index as i64)),
        //     A1RangeType::RowRange(rows) => {
        //         // todo: might want to shrink the rectangle if there is no
        //         // content at the front or back of the row range
        //         let y0 = rows.min.index as i64;
        //         let y1 = rows.max.index as i64;
        //         let x0 = 1;
        //         let mut x1 = 0;
        //         rows.iter().for_each(|row| {
        //             if let Some((_, max)) = self.row_bounds(row as i64, true) {
        //                 x1 = x1.max(max as u64);
        //             }
        //         });
        //         if x1 != 0 {
        //             Some(Rect::new(x0 as i64, y0 as i64, x1 as i64, y1 as i64))
        //         } else {
        //             None
        //         }
        //     }
        //     A1RangeType::Rect(rect) => Some(Rect::new(
        //         rect.min.x.index as i64,
        //         rect.min.y.index as i64,
        //         rect.max.x.index as i64,
        //         rect.max.y.index as i64,
        //     )),
        //     A1RangeType::Pos(pos) => Some(Rect::new(
        //         pos.x.index as i64,
        //         pos.y.index as i64,
        //         pos.x.index as i64,
        //         pos.y.index as i64,
        //     )),
        // }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;
    use crate::CellValue;

    #[test]
    #[parallel]
    fn test_a1_cells_rect_all() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((1, 1).into(), CellValue::Text("1".to_string()));
        sheet.set_cell_value((2, 3).into(), CellValue::Text("2".to_string()));
        sheet.recalculate_bounds();
        let all_cells = CellRefRange::ALL;
        assert_eq!(
            sheet.resolve_cell_ref(all_cells),
            Some(Rect::new(1, 1, 2, 3))
        );
    }

    #[test]
    #[parallel]
    fn test_a1_cells_rect_columns() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((1, 1).into(), CellValue::Text("1".to_string()));
        sheet.set_cell_value((2, 3).into(), CellValue::Text("2".to_string()));
        sheet.set_cell_value((5, 1).into(), CellValue::Text("3".to_string()));
        sheet.recalculate_bounds();
        let columns = CellRefRange::new_relative_column_range(1, 5);
        assert_eq!(sheet.resolve_cell_ref(columns), Some(Rect::new(1, 1, 5, 3)));
    }

    #[test]
    #[parallel]
    fn test_a1_cells_rect_rows() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value((1, 1).into(), CellValue::Text("1".to_string()));
        sheet.set_cell_value((2, 3).into(), CellValue::Text("2".to_string()));
        sheet.set_cell_value((1, 5).into(), CellValue::Text("4".to_string()));
        sheet.recalculate_bounds();
        let rows = CellRefRange::new_relative_row_range(1, 5);
        assert_eq!(sheet.resolve_cell_ref(rows), Some(Rect::new(1, 1, 2, 5)));
    }

    #[test]
    #[parallel]
    fn test_a1_cells_rect_empty() {
        let mut sheet = Sheet::test();
        sheet.recalculate_bounds();
        let all_cells = CellRefRange::ALL;
        assert_eq!(sheet.resolve_cell_ref(all_cells), None);
    }

    #[test]
    #[parallel]
    fn test_a1_cells_rect_specific() {
        let mut sheet = Sheet::test();
        sheet.recalculate_bounds();
        let specific_rect = Rect::new(1, 2, 3, 4);
        let rect_cells = CellRefRange::new_relative_rect(Rect::new(1, 2, 3, 4));
        assert_eq!(sheet.resolve_cell_ref(rect_cells), Some(specific_rect));
    }
}
