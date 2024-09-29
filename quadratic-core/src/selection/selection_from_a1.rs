use std::{collections::HashMap, str::FromStr};

use crate::{grid::SheetId, A1Error, Rect, A1};

use super::Selection;

impl Selection {
    /// Create a selection from an A1 string
    /// - sheets is sent from TS as we do not have access to Core here
    pub fn from_a1(
        mut a1: &str,
        sheet_id: SheetId,
        sheets: HashMap<String, String>,
    ) -> Result<Selection, A1Error> {
        let mut selection = Selection::new(sheet_id);
        // Count the number of exclamation marks in the A1 string
        let exclamation_count = a1.chars().filter(|&c| c == '!').count();

        // If there are more than one exclamation mark, return an error
        if exclamation_count > 1 {
            return Err(A1Error::TooManySheets);
        }
        if exclamation_count == 1 {
            let Some((sheet_name, remaining)) = a1.split_once('!') else {
                return Err(A1Error::TooManySheets);
            };
            // Remove single quotes around sheet name if present
            let sheet_name = sheet_name.trim_matches('\'');

            let sheet_id_string = sheets
                .iter()
                .find(|(k, _)| k.to_lowercase() == sheet_name.to_lowercase())
                .map(|(_, v)| v)
                .ok_or(A1Error::InvalidSheetName(sheet_name.to_string()))?;

            let sheet_id = SheetId::from_str(sheet_id_string)
                .map_err(|_| A1Error::InvalidSheetName(sheet_name.to_string()))?;
            selection.sheet_id = sheet_id;
            a1 = remaining;
        }
        let entries = a1.split(',');
        for entry in entries {
            let entry = entry.trim();

            // try range
            if let Some(rect) = A1::try_from_range(entry) {
                selection.add_rect(rect);
            }

            // try position
            if let Some(pos) = A1::try_from_pos(entry) {
                selection.x = pos.x;
                selection.y = pos.y;
                selection.add_rect(Rect::from_numbers(pos.x, pos.y, 1, 1));
            }

            // try columns
            if let Some(columns) = A1::try_from_columns(entry) {
                selection.add_columns(columns.iter().map(|x| *x as i64).collect());
            }

            // try rows
            if let Some(rows) = A1::try_from_rows(entry) {
                selection.add_rows(rows.iter().map(|x| *x as i64).collect());
            }

            // try all (which is just Selection::all)
            if entry == "*" {
                return Ok(Selection::all(sheet_id));
            }
        }

        // find the right place for the cursor
        if let Some(rects) = selection.rects.as_ref() {
            if !rects.is_empty() {
                selection.x = rects[0].min.x;
                selection.y = rects[0].min.y;
            }
        } else if let Some(columns) = selection.columns.as_ref() {
            if !columns.is_empty() {
                selection.x = columns[0];
            }
        } else if let Some(rows) = selection.rows.as_ref() {
            if !rows.is_empty() {
                selection.y = rows[0];
            }
        }

        Ok(selection)
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn test_from_a1() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("A1", sheet_id, HashMap::new()),
            Ok(Selection::new_sheet_pos(1, 1, sheet_id))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_all() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("*", sheet_id, HashMap::new()),
            Ok(Selection::all(sheet_id))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_columns() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("A:C", sheet_id, HashMap::new()),
            Ok(Selection::columns(&[1, 2, 3], sheet_id))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_rows() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("1:3", sheet_id, HashMap::new()),
            Ok(Selection::rows(&[1, 2, 3], sheet_id))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_rect() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("A1:B2", sheet_id, HashMap::new()),
            Ok(Selection::rect(Rect::new(1, 1, 2, 2), sheet_id))
        );
        assert_eq!(
            Selection::from_a1("D1:A5", sheet_id, HashMap::new()),
            Ok(Selection::rect(Rect::new(1, 1, 4, 5), sheet_id))
        );
        assert_eq!(
            Selection::from_a1("A1:B2,D1:A5", sheet_id, HashMap::new()),
            Ok(Selection::rects(
                &[Rect::new(1, 1, 2, 2), Rect::new(1, 1, 4, 5)],
                sheet_id
            ))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_everything() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1(
                "A1, B1::D2, E:G, 2:3, 5:7, F6:G8, 4",
                sheet_id,
                HashMap::new()
            ),
            Ok(Selection {
                sheet_id,
                x: 1,
                y: 1,
                rects: Some(vec![Rect::new(1, 1, 1, 1), Rect::new(6, 6, 7, 8),]),
                columns: Some(vec![5, 6, 7]),
                rows: Some(vec![2, 3, 4, 5, 6, 7]),
                all: false,
            })
        );
    }

    #[test]
    #[parallel]
    fn test_row_to_a1() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("1", sheet_id, HashMap::new()),
            Ok(Selection::rows(&[1], sheet_id))
        );

        assert_eq!(
            Selection::from_a1("1:3", sheet_id, HashMap::new()),
            Ok(Selection::rows(&[1, 2, 3], sheet_id))
        );

        assert_eq!(
            Selection::from_a1("1:", sheet_id, HashMap::new()),
            Ok(Selection::rows(&[1], sheet_id))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_sheets() {
        let sheet_id = SheetId::test();
        let sheets = HashMap::from([("Sheet1".to_string(), sheet_id.to_string())]);
        assert_eq!(
            Selection::from_a1("'Sheet1'!A1", sheet_id, sheets.clone()),
            Ok(Selection::new_sheet_pos(1, 1, sheet_id))
        );
        assert_eq!(
            Selection::from_a1("'sheet1'!A1", sheet_id, sheets),
            Ok(Selection::new_sheet_pos(1, 1, sheet_id))
        );
    }
}
