use crate::{grid::js_types::CellForArray, Pos, Rect};

use super::Sheet;

impl Sheet {
    pub fn cell_array(&self, rect: Rect) -> Vec<CellForArray> {
        let mut array = vec![];
        for y in rect.y_range() {
            for x in rect.x_range() {
                if let Some(cell) = self.get_cell_value(Pos { x, y }) {
                    array.push(CellForArray {
                        x,
                        y,
                        value: cell.to_edit(),
                    });
                } else {
                    array.push(CellForArray {
                        x,
                        y,
                        value: String::new(),
                    });
                }
            }
        }
        array
    }
}

// #[cfg(test)]
// mod test {
//     use crate::{grid::Sheet, CellValue, Pos, Rect};
//     use bigdecimal::BigDecimal;
//     use std::str::FromStr;

//     #[test]
//     fn test_cell_array() {
//         let mut sheet = Sheet::test();
//         assert_eq!(
//             sheet.cell_array(Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 10, y: 10 })),
//             vec![String::new(); 100]
//         );

//         sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Text(String::from("0,0")));
//         sheet.set_cell_value(
//             Pos { x: 0, y: 1 },
//             CellValue::Number(BigDecimal::from_str("10.10").unwrap()),
//         );
//         assert_eq!(
//             sheet.cell_array(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 1 })),
//             vec![String::from("0,0"), String::from("10.10")]
//         );
//     }
// }
