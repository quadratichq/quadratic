use std::str::FromStr;

use quadratic_core::{grid::SheetId, A1Selection};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct JsCoordinate {
    pub x: u32,
    pub y: u32,
}

#[wasm_bindgen]
pub struct Selection {
    selection: A1Selection,
}

#[wasm_bindgen]
impl Selection {
    #[wasm_bindgen(constructor)]
    pub fn new(sheet_id: String) -> Self {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Selection {
            selection: A1Selection::from_xy(1, 1, sheet_id),
        }
    }

    /// Saves the selection to a JSON string.
    #[wasm_bindgen]
    pub fn save(&self) -> Result<String, String> {
        serde_json::to_string(&self.selection).map_err(|e| e.to_string())
    }

    /// Loads the selection from a JSON string.
    #[wasm_bindgen]
    pub fn load(selection: String) -> Result<Selection, String> {
        let selection: A1Selection = serde_json::from_str(&selection).map_err(|e| e.to_string())?;
        Ok(Selection { selection })
    }

    /// Returns the cursor position (as a JsCoordinate)
    #[wasm_bindgen(js_name = "getCursor")]
    pub fn cursor(&self) -> JsCoordinate {
        JsCoordinate {
            x: self.selection.cursor.x as u32,
            y: self.selection.cursor.y as u32,
        }
    }

    /// Selects the entire sheet.
    #[wasm_bindgen(js_name = "selectAll")]
    pub fn select_all(&mut self) {
        self.selection.select_all();
    }

    #[wasm_bindgen(js_name = "selectColumn")]
    pub fn select_column(&mut self, column: u32, append: bool) {
        self.selection.select_column(column, append);
    }
}

// #[allow(non_snake_case)]
// #[wasm_bindgen(js_name = "posToA1")]
// pub fn pos_to_a1(x: u32, y: u32) -> String {
//     A1::pos_to_a1(x as u64, y as u64)
// }

// #[allow(non_snake_case)]
// #[wasm_bindgen(js_name = "posToA1Absolute")]
// pub fn pos_to_a1_absolute(x: u32, y: u32) -> String {
//     A1::pos_to_a1_absolute(x as u64, y as u64)
// }

// #[allow(non_snake_case)]
// #[wasm_bindgen(js_name = "selectionToA1")]
// pub fn a1_to_pos(selection: &str, sheet_id: &str, sheets: &str) -> Result<String, String> {
//     let Ok(selection) = OldSelection::from_str(selection) else {
//         return Err(format!("Invalid selection: {}", selection));
//     };
//     let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
//         return Err(A1Error::InvalidSheetId(sheet_id.to_string()).into());
//     };
//     let Ok(sheets) = serde_json::from_str::<SheetNameIdMap>(sheets) else {
//         return Err(A1Error::InvalidSheetMap(sheets.to_string()).into());
//     };
//     Ok(selection.to_a1(sheet_id, sheets))
// }

// #[allow(non_snake_case)]
// #[wasm_bindgen(js_name = "a1StringToSelection")]
// /// Converts an A1 string (eg, A1:B2,C3:D4) to a Selection
// /// where sheets is a HashMap<String, String> of sheet_name to sheet_id
// pub fn a1_to_selection(a1: &str, sheet_id: &str, sheets: &str) -> Result<String, String> {
//     let sheet_id =
//         SheetId::from_str(sheet_id).map_err(|_| A1Error::InvalidSheetId(sheet_id.to_string()))?;

//     let sheet_map = serde_json::from_str::<SheetNameIdMap>(sheets)
//         .map_err(|_| A1Error::InvalidSheetMap(sheets.to_string()))?;

//     match OldSelection::from_a1(a1, sheet_id, sheet_map) {
//         Ok(selection) => Ok(selection.into()),
//         Err(err) => Err(err.into()),
//     }
// }

// #[allow(non_snake_case)]
// #[wasm_bindgen(js_name = "selectionToA1String")]
// /// Converts a Selection to a string value (eg, A1:B2,C3:D4)
// pub fn a1_to_sheet_id(selection: &str, sheet_id: &str, sheets: &str) -> Result<String, String> {
//     if let (Ok(selection), Ok(sheet_id), Ok(sheets)) = (
//         OldSelection::from_str(selection),
//         SheetId::from_str(sheet_id),
//         serde_json::from_str::<SheetNameIdMap>(sheets),
//     ) {
//         Ok(selection.to_a1(sheet_id, sheets))
//     } else {
//         Err(format!("Invalid selection: {}", selection))
//     }
// }

// #[allow(non_snake_case)]
// #[wasm_bindgen(js_name = "a1ToCells")]
// pub fn a1_to_cells(a1: &str) -> Result<String, String> {
//     let cells = A1::to_cells(a1)?;

//     match serde_json::to_string(&cells) {
//         Ok(json) => Ok(json),
//         Err(e) => Err(e.to_string()),
//     }
// }

// #[cfg(test)]
// mod tests {
//     use std::collections::HashMap;

//     use super::*;
//     use quadratic_core::Rect;

//     #[test]
//     fn test_a1_to_selection() {
//         let selection = "A1:B2,C3:D4";
//         let sheet_id = SheetId::test();
//         let result = a1_to_selection(selection, &sheet_id.to_string(), "{}");
//         let selection = OldSelection {
//             sheet_id,
//             rects: Some(vec![Rect::new(1, 1, 2, 2), Rect::new(3, 3, 4, 4)]),
//             ..Default::default()
//         };
//         assert_eq!(result.unwrap(), serde_json::to_string(&selection).unwrap());
//     }

//     #[test]
//     fn test_a1_to_selection_sheet_names() {
//         let selection = "Sheet1!A1:B2,Sheet2!C3:D4";
//         let sheet_id = SheetId::new();
//         let sheet_id2 = SheetId::new();
//         let map = HashMap::from([("Sheet1", sheet_id), ("Sheet2", sheet_id2)]);
//         let map_str = serde_json::to_string(&map).unwrap();
//         assert_eq!(
//             a1_to_selection(selection, &sheet_id.to_string(), &map_str),
//             Err(A1Error::TooManySheets(selection.to_string()).into())
//         )
//     }

//     #[test]
//     fn test_a1_to_selection_invalid_sheet_name() {
//         let selection = "'Bad Name'!A1:B2,C3:D4";
//         let sheet_id = SheetId::test();
//         assert_eq!(
//             a1_to_selection(selection, &sheet_id.to_string(), "{}"),
//             Err(A1Error::InvalidSheetName("Bad Name".to_string()).into())
//         );
//         let selection = "'Bad Name'!A1:B2,C3:D4";
//         assert_eq!(
//             a1_to_selection(selection, &sheet_id.to_string(), "{}"),
//             Err(A1Error::InvalidSheetName("Bad Name".to_string()).into())
//         );
//     }

//     #[test]
//     fn test_a1_to_selection_invalid_sheet_map() {
//         let selection = "A1:B2,C3:D4";
//         let sheet_id = SheetId::test();
//         assert_eq!(
//             a1_to_selection(selection, &sheet_id.to_string(), ""),
//             Err(A1Error::InvalidSheetMap("".to_string()).into())
//         );
//     }
// }
