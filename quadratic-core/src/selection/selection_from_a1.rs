use crate::{grid::SheetId, A1Error, Rect, A1};

use super::Selection;

impl Selection {
    /// Create a selection from an A1 string
    pub fn from_a1(a1: &str, sheet_id: SheetId) -> Result<Selection, A1Error> {
        let mut selection = Selection::new(sheet_id);
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
            Selection::from_a1("A1", sheet_id),
            Ok(Selection::new_sheet_pos(1, 1, sheet_id))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_all() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("*", sheet_id),
            Ok(Selection::all(sheet_id))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_columns() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("A:C", sheet_id),
            Ok(Selection::columns(&[1, 2, 3], sheet_id))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_rows() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("1:3", sheet_id),
            Ok(Selection::rows(&[1, 2, 3], sheet_id))
        );
    }

    #[test]
    #[parallel]
    fn test_from_a1_rect() {
        let sheet_id = SheetId::test();
        assert_eq!(
            Selection::from_a1("A1:B2", sheet_id),
            Ok(Selection::rect(Rect::new(1, 1, 2, 2), sheet_id))
        );
        assert_eq!(
            Selection::from_a1("D1:A5", sheet_id),
            Ok(Selection::rect(Rect::new(1, 1, 4, 5), sheet_id))
        );
        assert_eq!(
            Selection::from_a1("A1:B2,D1:A5", sheet_id),
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
            Selection::from_a1("A1, B1::D2, E:G, 2:3, 5:7, F6:G8, 4", sheet_id),
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
}
