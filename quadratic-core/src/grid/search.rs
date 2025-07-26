use std::str::FromStr;

use crate::grid::js_types::JsSheetPosText;

use super::{Grid, SheetId, sheet::search::SearchOptions};

impl Grid {
    pub fn search(&self, query: &String, options: SearchOptions) -> Vec<JsSheetPosText> {
        let mut result = Vec::new();
        if let Some(sheet_id) = options
            .sheet_id
            .as_ref()
            .map(|id| SheetId::from_str(id).unwrap_or_default())
        {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                let sheet_result = sheet.search(query, &options);
                result.extend(sheet_result);
            }
        } else {
            for sheet in self.sheets().values() {
                let sheet_result = sheet.search(query, &options);
                result.extend(sheet_result);
            }
        }
        result
    }
}

#[cfg(test)]
mod test {
    use crate::{CellValue, Pos};

    use super::*;

    #[test]
    fn search() {
        let mut grid = Grid::new();
        let sheet_id = grid.sheet_ids()[0];

        let sheet = grid.try_sheet_mut(sheet_id).unwrap();
        sheet.set_cell_value(Pos { x: 0, y: 1 }, "hello".to_string());
        sheet.set_cell_value(Pos { x: -10, y: -11 }, "world".to_string());
        sheet.set_cell_value(Pos { x: 100, y: 200 }, "123".to_string());

        assert_eq!(
            sheet.cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("hello".to_string()))
        );

        let result = grid.search(&"hello".to_string(), SearchOptions::default());
        assert_eq!(result.len(), 1);
        assert_eq!(
            result[0],
            JsSheetPosText {
                sheet_id: sheet_id.to_string(),
                x: 0,
                y: 1,
                text: Some("hello".to_string()),
            }
        );

        let result = grid.search(&"world".to_string(), SearchOptions::default());
        assert_eq!(result.len(), 1);
        assert_eq!(
            result[0],
            JsSheetPosText {
                sheet_id: sheet_id.to_string(),
                x: -10,
                y: -11,
                text: Some("world".to_string()),
            }
        );

        let result = grid.search(&"123".to_string(), SearchOptions::default());
        assert_eq!(result.len(), 1);
        assert_eq!(
            result[0],
            JsSheetPosText {
                sheet_id: sheet_id.to_string(),
                x: 100,
                y: 200,
                text: Some("123".to_string()),
            }
        );

        let result = grid.search(
            &"HELLO".to_string(),
            SearchOptions {
                case_sensitive: Some(true),
                ..SearchOptions::default()
            },
        );
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn search_multiple_sheets() {
        let mut grid = Grid::new();
        let sheet_id1 = grid.sheet_ids()[0];
        let sheet_id2 = grid.add_sheet(None);

        let sheet1 = grid.try_sheet_mut(sheet_id1).unwrap();
        sheet1.set_cell_value(Pos { x: 0, y: 1 }, "hello".to_string());

        let sheet2 = grid.try_sheet_mut(sheet_id2).unwrap();
        sheet2.set_cell_value(Pos { x: 0, y: 1 }, "hello2".to_string());

        let result = grid.search(&"hello".to_string(), SearchOptions::default());
        assert_eq!(result.len(), 2);
        let result = grid.search(
            &"hello".to_string(),
            SearchOptions {
                sheet_id: Some(sheet_id1.to_string()),
                ..SearchOptions::default()
            },
        );
        assert_eq!(result.len(), 1);

        let result = grid.search(
            &"hello".to_string(),
            SearchOptions {
                sheet_id: Some(sheet_id2.to_string()),
                ..SearchOptions::default()
            },
        );
        assert_eq!(result.len(), 1);

        let result = grid.search(
            &"hello".to_string(),
            SearchOptions {
                sheet_id: Some(sheet_id2.to_string()),
                whole_cell: Some(true),
                ..SearchOptions::default()
            },
        );
        assert_eq!(result.len(), 0);
    }
}
