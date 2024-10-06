use crate::{a1_parts::A1Parts, grid::SheetId, A1Error, A1Range, Rect, SheetNameIdMap};

use super::Selection;

impl Selection {
    /// Create a selection from an A1 string
    /// - sheets is sent from TS as we do not have access to Core here
    /// Note: this is not a complete Selection as we can't exclude from column/row/all ranges (yet)
    pub fn from_a1(
        a1: &str,
        sheet_id: SheetId,
        sheets: SheetNameIdMap,
    ) -> Result<Selection, A1Error> {
        let mut selection = Selection::new(sheet_id);

        let parts = A1Parts::from_a1(a1, sheet_id, sheets)?;

        let sheets = parts.sheets();

        // regrettably we can't handle multiple sheets in a Selection (yet?)
        if sheets.len() > 1 {
            return Err(A1Error::TooManySheets(a1.to_string()));
        }

        // if the origin sheet_id is not in the parts, then switch the
        // Selection's sheet_id to the first Part's sheet_id.
        if !sheets.contains(&sheet_id) {
            selection.sheet_id = parts.iter().find_map(|part| part.sheet_id).ok_or_else(|| {
                A1Error::InvalidSheetId(
                    "No sheet ID found when converting from A1 to Selection".to_string(),
                )
            })?;
        }
        parts.iter().for_each(|part| match part.range {
            A1Range::Pos(pos) => {
                selection.x = pos.x.index as i64;
                selection.y = pos.y.index as i64;
                selection.rects.get_or_insert_with(Vec::new).push(Rect::new(
                    pos.x.index as i64,
                    pos.y.index as i64,
                    pos.x.index as i64,
                    pos.y.index as i64,
                ));
            }
            A1Range::Column(col) => {
                selection
                    .columns
                    .get_or_insert_with(Vec::new)
                    .push(col.index as i64);
            }
            A1Range::Row(row) => {
                selection
                    .rows
                    .get_or_insert_with(Vec::new)
                    .push(row.index as i64);
            }
            A1Range::ColumnRange(range) => {
                for col in range.from.index..=range.to.index {
                    selection
                        .columns
                        .get_or_insert_with(Vec::new)
                        .push(col as i64);
                }
            }
            A1Range::RowRange(range) => {
                for row in range.from.index..=range.to.index {
                    selection.rows.get_or_insert_with(Vec::new).push(row as i64);
                }
            }
            A1Range::Rect(rect) => {
                // normalize the rect to a min-max rect
                let x0 = rect.min.x.index.min(rect.max.x.index) as i64;
                let y0 = rect.min.y.index.min(rect.max.y.index) as i64;
                let x1 = rect.min.x.index.max(rect.max.x.index) as i64;
                let y1 = rect.min.y.index.max(rect.max.y.index) as i64;
                selection
                    .rects
                    .get_or_insert_with(Vec::new)
                    .push(Rect::new(x0, y0, x1, y1));
            }
            A1Range::All => {
                selection.all = true;
            }
            _ => (),
        });

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
        let selection =
            Selection::from_a1("A1,B1:D2,E:G,2:3,5:7,F6:G8,4", sheet_id, HashMap::new()).unwrap();

        assert_eq!(selection.sheet_id, sheet_id);
        assert_eq!(selection.x, 1);
        assert_eq!(selection.y, 1);
        let rects = selection.rects.unwrap().clone();
        assert_eq!(rects.len(), 3);
        assert!(rects.contains(&Rect::new(1, 1, 1, 1)));
        assert!(rects.contains(&Rect::new(6, 6, 7, 8)));
        assert!(rects.contains(&Rect::new(2, 1, 4, 2)));
        assert_eq!(selection.columns, Some(vec![5, 6, 7]));
        assert_eq!(selection.rows, Some(vec![2, 3, 5, 6, 7, 4]));
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
        let sheet_id = SheetId::new();
        let sheet_id2 = SheetId::new();
        let sheets = HashMap::from([
            ("Sheet1".to_string(), sheet_id),
            ("Second".to_string(), sheet_id2),
        ]);
        assert_eq!(
            Selection::from_a1("'Second'!A1", sheet_id, sheets),
            Ok(Selection::new_sheet_pos(1, 1, sheet_id2))
        );
    }
}
