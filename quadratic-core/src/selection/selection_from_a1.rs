use crate::{a1_parts::A1Parts, grid::SheetId, A1Error, Rect, SheetNameIdMap};

use super::Selection;

impl Selection {
    /// Create a selection from an A1 string
    /// - sheets is sent from TS as we do not have access to Core here
    pub fn from_a1(
        a1: &str,
        sheet_id: SheetId,
        sheets: SheetNameIdMap,
    ) -> Result<Selection, A1Error> {
        let mut selection = Selection::new(sheet_id);

        let parts: A1Parts = A1Parts::from_a1(a1)?;

        if let Some(sheet_name) = parts.sheet_name {
            let different_sheet_id = sheets
                .iter()
                .find(|(name, _)| name.to_lowercase() == sheet_name.to_lowercase())
                .map(|(_, sheet_id)| sheet_id)
                .ok_or(A1Error::InvalidSheetName(sheet_name))?;

            selection.sheet_id = different_sheet_id.to_owned();
        }

        if parts.all {
            selection.all = true;
            return Ok(selection);
        }

        for column in parts.columns {
            selection.add_columns(vec![column.index as i64]);
        }
        for row in parts.rows {
            selection.add_rows(vec![row.index as i64]);
        }
        for column_range in parts.column_ranges {
            selection.add_columns(
                (column_range.from.index as i64..=column_range.to.index as i64).collect(),
            );
        }
        for row_range in parts.row_ranges {
            selection.add_rows((row_range.from.index as i64..=row_range.to.index as i64).collect());
        }
        for rect in parts.rects {
            let x0 = rect.min.x.min(rect.max.x) as i64;
            let y0 = rect.min.y.min(rect.max.y) as i64;
            let x1 = rect.min.x.max(rect.max.x) as i64;
            let y1 = rect.min.y.max(rect.max.y) as i64;
            selection.add_rect(Rect::new(x0, y0, x1, y1));
        }
        for pos in parts.positions {
            selection.add_rect(Rect::new(pos.x as i64, pos.y as i64, 1, 1));
            selection.x = pos.x as i64;
            selection.y = pos.y as i64;
        }

        Ok(selection)
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

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
        let selection = Selection::from_a1(
            "A1, B1::D2, E:G, 2:3, 5:7, F6:G8, 4",
            sheet_id,
            HashMap::new(),
        )
        .unwrap();

        assert_eq!(selection.sheet_id, sheet_id);
        assert_eq!(selection.x, 1);
        assert_eq!(selection.y, 1);
        let rects = selection.rects.unwrap().clone();
        assert_eq!(rects.len(), 2);
        assert!(rects.contains(&Rect::new(1, 1, 1, 1)));
        assert!(rects.contains(&Rect::new(6, 6, 7, 8)));
        assert_eq!(selection.columns, Some(vec![5, 6, 7]));
        assert_eq!(selection.rows, Some(vec![2, 3, 4, 5, 6, 7]));
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
        let sheets = HashMap::from([("Sheet1".to_string(), sheet_id)]);
        assert_eq!(
            Selection::from_a1("'Sheet1'!A1", sheet_id, sheets.clone()),
            Ok(Selection::new_sheet_pos(1, 1, sheet_id))
        );
        assert_eq!(
            Selection::from_a1("'sheet1'!A1", sheet_id, sheets),
            Ok(Selection::new_sheet_pos(1, 1, sheet_id))
        );

        let second_sheet_id = SheetId::new();
        let sheets = HashMap::from([
            ("First".to_string(), sheet_id),
            ("Second".to_string(), second_sheet_id),
        ]);
        assert_eq!(
            Selection::from_a1("'Second'!A1", sheet_id, sheets),
            Ok(Selection::new_sheet_pos(1, 1, second_sheet_id))
        );
    }
}
