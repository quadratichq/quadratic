use crate::{
    controller::transaction_types::{CellForArray, CellsForArray},
    Pos, Rect,
};

use super::Sheet;

impl Sheet {
    pub fn cell_array(&self, rect: Rect) -> CellsForArray {
        let mut array = vec![];
        for y in rect.y_range() {
            for x in rect.x_range() {
                if let Some(cell) = self.get_cell_value(Pos { x, y }) {
                    array.push(CellForArray::new(x, y, Some(cell.to_edit())));
                } else {
                    array.push(CellForArray::new(x, y, None));
                }
            }
        }
        CellsForArray::new(array, false)
    }
}
