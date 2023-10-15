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
        CellsForArray::new(array)
    }

    // pub fn update_code_cell_value(
    //     &mut self,
    //     pos: Pos,
    //     code_cell_value: Option<CodeCellValue>,
    //     summary: &mut TransactionSummary,
    // ) -> Option<CodeCellValue> {
    //     let old_code_cell_value = update_code_cell_value(
    //         grid_controller,
    //         sheet_pos,
    //         updated_code_cell_value,
    //         cells_to_compute,
    //         reverse_operations,
    //         summary,
    //     );

    //     let old_code_cell_value = self.set_code_cell_value(pos, code_cell_value);
    //     let mut summary_set = vec![];
    //     if let Some(code_cell_value) = code_cell_value {
    //         if let Some(output) = code_cell_value.output {
    //             match output.result.output_value() {
    //                 Some(output_value) => {
    //                     match output_value {
    //                         Value::Array(array) => {
    //                             for y in 0..array.size().h.into() {
    //                                 for x in 0..array.size().w.into() {
    //                                     if let Ok(value) = array.get(x, y) {
    //                                         let entry_pos = Pos {
    //                                             x: pos.x + x as i64,
    //                                             y: pos.y + y as i64,
    //                                         };
    //                                         let (numeric_format, numeric_decimals) =
    //                                             self.cell_numeric_info(entry_pos);
    //                                         summary_set.push(JsRenderCellUpdate {
    //                                             x: pos.x + x as i64,
    //                                             y: pos.y + y as i64,
    //                                             update: JsRenderCellUpdateEnum::Value(Some(
    //                                                 value.to_display(
    //                                                     numeric_format,
    //                                                     numeric_decimals,
    //                                                 ),
    //                                             )),
    //                                         });
    //                                     }
    //                                 }
    //                             }
    //                         }
    //                         Value::Single(value) => {
    //                             let (numeric_format, numeric_decimals) =
    //                                 self.cell_numeric_info(pos);
    //                             summary_set.push(JsRenderCellUpdate {
    //                                 x: pos.x,
    //                                 y: pos.y,
    //                                 update: JsRenderCellUpdateEnum::Value(Some(
    //                                     value.to_display(numeric_format, numeric_decimals),
    //                                 )),
    //                             });
    //                         }
    //                     };
    //                 }
    //                 None => {
    //                     summary_set.push(JsRenderCellUpdate {
    //                         x: pos.x,
    //                         y: pos.y,
    //                         update: JsRenderCellUpdateEnum::Value(Some(" ERROR".into())),
    //                     });
    //                     summary_set.push(JsRenderCellUpdate {
    //                         x: pos.x,
    //                         y: pos.y,
    //                         update: JsRenderCellUpdateEnum::TextColor(Some("red".into())),
    //                     });
    //                     summary_set.push(JsRenderCellUpdate {
    //                         x: pos.x,
    //                         y: pos.y,
    //                         update: JsRenderCellUpdateEnum::Italic(Some(true)),
    //                     });
    //                 }
    //             };
    //         }
    //     }
    //     fetch_code_cell_difference(
    //         self,
    //         SheetPos {
    //             sheet_id: self.id,
    //             x: pos.x,
    //             y: pos.y,
    //         },
    //         old_code_cell_value.clone(),
    //         Some(code_cell_value.clone()),
    //         &mut summary_set,
    //         None,
    //     );
    //     self.reverse_operations.push(Operation::SetCellCode {
    //         cell_ref: sheet.get_or_create_cell_ref(current_sheet_pos.into()),
    //         code_cell_value: old_code_cell_value,
    //     });
    //     if !summary_set.is_empty() {
    //         self.summary
    //             .operations
    //             .push(OperationSummary::SetCellValues(
    //                 sheet.id.to_string(),
    //                 summary_set.clone(),
    //             ));
    //     }
    //     self.summary.code_cells_modified.insert(sheet.id);
    //     grid_controller.grid.set_dependencies(
    //         current_sheet_pos,
    //         Some(
    //             self.cells_accessed
    //                 .iter()
    //                 .filter_map(|cell_ref| {
    //                     if let Some(pos) = sheet.cell_ref_to_pos(*cell_ref) {
    //                         Some(SheetRect::single_pos(SheetPos {
    //                             x: pos.x,
    //                             y: pos.y,
    //                             sheet_id: sheet.id,
    //                         }))
    //                     } else {
    //                         None
    //                     }
    //                 })
    //                 .collect(),
    //         ),
    //     );
    //     if !summary_set.is_empty() {
    //         summary.operations.push(OperationSummary::SetCellValues(
    //             sheet.id.to_string(),
    //             summary_set,
    //         ));
    //     }
    //     summary.code_cells_modified.insert(sheet.id);
    //     Operation::SetCellCode {
    //         cell_ref,
    //         code_cell_value: old_code_cell_value,
    //     }
    // }
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
