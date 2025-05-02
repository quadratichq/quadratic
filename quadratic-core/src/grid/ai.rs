use crate::{
    a1::{A1Error, A1Selection},
    controller::GridController,
};

impl GridController {
    /// Returns the rendered values of the cells in a given rect. Note: this
    /// will return only the first range given within a selection.
    pub fn get_ai_cells(&self, selection: A1Selection) -> Result<String, A1Error> {
        let range = &selection.ranges[0];
        if let Some(rect) = range.to_rect(self.a1_context()) {
            if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                let cells = sheet.get_cells_as_string(rect);
                Ok(cells)
            } else {
                Err(A1Error::SheetNotFound)
            }
        } else {
            Err(A1Error::InvalidTableRef(format!(
                "Invalid table range: {}",
                range.to_string()
            )))
        }
    }
}

// #[cfg(test)]
// mod tests {
//     use crate::a1::{A1Error, A1Selection, CellRefRange, ColRange};
//     use crate::grid::SheetId;
//     use crate::{TableRef, test_util::*};

//     #[test]
//     fn test_ai_get_cells_valid_range() {
//         let mut gc = test_create_gc();
//         let sheet_id = first_sheet_id(&gc);

//         // sets values in a 3x3 grid to 0, 1, ...
//         test_set_values(&mut gc, sheet_id, pos![a1], 3, 3);

//         let selection = A1Selection::test_a1("A1:C4");

//         let result = gc.get_ai_cells(selection).unwrap();
//         assert_eq!(result.x, 1);
//         assert_eq!(result.y, 1);
//         assert_eq!(result.width, 3);
//         assert_eq!(result.height, 4);
//         assert_eq!(
//             result.cells,
//             serde_json::to_string(&vec![
//                 "0", "3", "6", "", "1", "4", "7", "", "2", "5", "8", ""
//             ])
//             .unwrap()
//         );
//     }

//     #[test]
//     fn test_ai_get_cells_invalid_range() {
//         let gc = test_create_gc();
//         let sheet_id = first_sheet_id(&gc);

//         let selection = A1Selection {
//             sheet_id,
//             cursor: pos![a1],
//             ranges: vec![CellRefRange::Table {
//                 range: TableRef {
//                     table_name: "no-table".to_string(),
//                     data: true,
//                     headers: false,
//                     totals: false,
//                     col_range: ColRange::All,
//                 },
//             }],
//         };

//         let result = gc.get_ai_cells(selection);

//         assert!(result.is_err());
//         assert!(matches!(result.unwrap_err(), A1Error::InvalidTableRef(_)));
//     }

//     #[test]
//     fn test_ai_get_cells_sheet_not_found() {
//         let gc = test_create_gc();
//         let invalid_sheet_id = SheetId::new();

//         let selection = A1Selection {
//             sheet_id: invalid_sheet_id,
//             cursor: pos![a1],
//             ranges: vec![crate::a1::CellRefRange::Sheet {
//                 range: crate::a1::RefRangeBounds::new_relative(1, 1, 2, 2),
//             }],
//         };

//         let result = gc.get_ai_cells(selection);

//         assert!(result.is_err());
//         assert!(matches!(result.unwrap_err(), A1Error::SheetNotFound));
//     }
// }
