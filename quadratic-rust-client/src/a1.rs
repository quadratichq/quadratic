use std::str::FromStr;

use quadratic_core::{grid::SheetId, selection::Selection, A1Error, SheetNameIdMap, A1};
use wasm_bindgen::prelude::*;

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "posToA1")]
pub fn pos_to_a1(x: u32, y: u32) -> String {
    A1::pos_to_a1(x as u64, y as u64)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "selectionToA1")]
pub fn a1_to_pos(selection: &str, sheet_id: &str, sheets: &str) -> Result<String, String> {
    let Ok(selection) = Selection::from_str(selection) else {
        return Err(format!("Invalid selection: {}", selection));
    };
    let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
        return Err(A1Error::InvalidSheetId(sheet_id.to_string()).into());
    };
    let Ok(sheets) = serde_json::from_str::<SheetNameIdMap>(sheets) else {
        return Err(A1Error::InvalidSheetMap(sheets.to_string()).into());
    };
    Ok(selection.to_a1(sheet_id, sheets))
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "a1StringToSelection")]
/// Converts an A1 string (eg, A1:B2,C3:D4) to a Selection
/// where sheets is a HashMap<String, String> of sheet_name to sheet_id
pub fn a1_to_selection(a1: &str, sheet_id: &str, sheets: &str) -> Result<String, String> {
    let sheet_id =
        SheetId::from_str(sheet_id).map_err(|_| A1Error::InvalidSheetId(sheet_id.to_string()))?;

    let sheets = serde_json::from_str::<SheetNameIdMap>(sheets)
        .map_err(|_| A1Error::InvalidSheetMap(sheets.to_string()))?;

    match Selection::from_a1(a1, sheet_id, sheets) {
        Ok(selection) => Ok(selection.into()),
        Err(err) => Err(err.into()),
    }
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "selectionToA1String")]
/// Converts a Selection to a string value (eg, A1:B2,C3:D4)
pub fn a1_to_sheet_id(selection: &str, sheet_id: &str, sheets: &str) -> Result<String, String> {
    if let (Ok(selection), Ok(sheet_id), Ok(sheets)) = (
        Selection::from_str(selection),
        SheetId::from_str(sheet_id),
        serde_json::from_str::<SheetNameIdMap>(sheets),
    ) {
        Ok(selection.to_a1(sheet_id, sheets))
    } else {
        Err(format!("Invalid selection: {}", selection))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use quadratic_core::Rect;

    #[test]
    fn test_a1_to_selection() {
        let selection = "A1:B2,C3:D4";
        let sheet_id = SheetId::test();
        let result = a1_to_selection(selection, &sheet_id.to_string(), "{}");
        let selection = Selection {
            sheet_id,
            rects: Some(vec![Rect::new(1, 1, 2, 2), Rect::new(3, 3, 4, 4)]),
            ..Default::default()
        };
        assert_eq!(result.unwrap(), serde_json::to_string(&selection).unwrap());
    }

    #[test]
    fn test_a1_to_selection_sheet_names() {
        let selection = "Sheet1!A1:B2,Sheet2!C3:D4";
        let sheet_id = SheetId::test();
        assert_eq!(
            a1_to_selection(selection, &sheet_id.to_string(), "{}"),
            Err(A1Error::TooManySheets.into())
        )
    }

    #[test]
    fn test_a1_to_selection_invalid_sheet_name() {
        let selection = "'Bad Name'!A1:B2,C3:D4";
        let sheet_id = SheetId::test();
        assert_eq!(
            a1_to_selection(selection, &sheet_id.to_string(), "{}"),
            Err(A1Error::InvalidSheetName("Bad Name".to_string()).into())
        );
        let selection = "Bad Name!A1:B2,C3:D4";
        assert_eq!(
            a1_to_selection(selection, &sheet_id.to_string(), "{}"),
            Err(A1Error::InvalidSheetName("Bad Name".to_string()).into())
        );
    }

    #[test]
    fn test_a1_to_selection_invalid_sheet_map() {
        let selection = "A1:B2,C3:D4";
        let sheet_id = SheetId::test();
        assert_eq!(
            a1_to_selection(selection, &sheet_id.to_string(), ""),
            Err(A1Error::InvalidSheetMap("".to_string()).into())
        );
    }
}
