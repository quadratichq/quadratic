use super::{A1Selection, CellRefRange, CellRefRangeEnd};

impl A1Selection {
    /// Handles the keyboard extend event (shift+arrow, or shift+cmd+arrow,
    /// where the delta for cmd+arrow comes from core)
    pub fn keyboard_extend(&mut self, delta_x: i64, delta_y: i64) {
        if let Some(last_range) = self.ranges.last_mut() {
            if let Some(end) = last_range.end {
                last_range.end = Some(end.expand(delta_x, delta_y));
            } else {
                last_range.end = Some(CellRefRangeEnd {
                    col: last_range.start.col.map(|c| c.clone().expand(delta_x)),
                    row: last_range.start.row.map(|r| r.clone().expand(delta_y)),
                });
            }
        } else {
            self.ranges.push(CellRefRange {
                start: CellRefRangeEnd::new_relative_xy(self.cursor.x as u64, self.cursor.y as u64),
                end: Some(CellRefRangeEnd::new_relative_xy(
                    (self.cursor.x as i64 + delta_x) as u64,
                    (self.cursor.y as i64 + delta_y) as u64,
                )),
            });
        }
    }

    /// Handles the pointer down event.
    pub fn pointer_down(&mut self, column: u64, row: u64, ctrl_key: bool, shift_key: bool) {
        if shift_key {
            self.extend_selection(column, row, ctrl_key);
        } else {
            self.move_to(column as i64, row as i64, ctrl_key);
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_keyboard_extend() {
        let mut selection = A1Selection::test("A1,B1,C1");
        selection.keyboard_extend(1, 1);
        assert_eq!(selection.test_string(), "A1,B1,C1:D2");

        selection = A1Selection::test("D2:E2");
        selection.keyboard_extend(1, 0);
        assert_eq!(selection.test_string(), "D2:F2");

        selection = A1Selection::test("D:E");
        selection.keyboard_extend(1, 0);
        assert_eq!(selection.test_string(), "D:F");

        selection = A1Selection::test("D:E");
        selection.keyboard_extend(0, 1);
        assert_eq!(selection.test_string(), "D:E");

        selection = A1Selection::test("A1,3");
        selection.keyboard_extend(0, 1);
        assert_eq!(selection.test_string(), "A1,3:4");

        selection = A1Selection::test("A1:B2");
        selection.keyboard_extend(-1, -1);
        assert_eq!(selection.test_string(), "A1");

        selection = A1Selection::test("2:4");
        selection.keyboard_extend(0, 2);
        assert_eq!(selection.test_string(), "2:6");

        selection = A1Selection::test("A:C");
        selection.keyboard_extend(-1, 0);
        assert_eq!(selection.test_string(), "A:B");

        selection = A1Selection::test("A1,B2,C3");
        selection.keyboard_extend(1, 1);
        assert_eq!(selection.test_string(), "A1,B2,C3:D4");
    }

    #[test]
    fn test_keyboard_extend_negative_range() {
        let mut selection = A1Selection::test("B2");
        selection.keyboard_extend(-2, -2);
        assert_eq!(selection.test_string(), "B2:A1");

        selection = A1Selection::test("A1");
        selection.keyboard_extend(-1, -1);
        assert_eq!(selection.test_string(), "A1");

        selection = A1Selection::test("E5:G6");
        selection.keyboard_extend(-3, -3);
        assert_eq!(selection.test_string(), "E5:D3");
    }

    #[test]
    fn test_keyboard_extend_zero() {
        let mut selection = A1Selection::test("A1");
        selection.keyboard_extend(0, 0);
        assert_eq!(selection.test_string(), "A1");
    }

    #[test]
    fn test_pointer_down() {
        let mut selection = A1Selection::test("A1");
        selection.pointer_down(2, 2, false, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("B2")]);
        assert_eq!(selection.cursor, "B2".into());
    }

    #[test]
    fn test_pointer_down_with_ctrl() {
        let mut selection = A1Selection::test("A1");
        selection.pointer_down(2, 2, true, false);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("A1"), CellRefRange::test("B2")]
        );
        assert_eq!(selection.cursor, "B2".into());

        selection = A1Selection::test("A1,A1:B3");
        selection.pointer_down(4, 4, true, false);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("A1"),
                CellRefRange::test("A1:B3"),
                CellRefRange::test("D4")
            ]
        );
        assert_eq!(selection.cursor, "D4".into());
    }

    #[test]
    fn test_pointer_down_with_shift() {
        let mut selection = A1Selection::test("A1");
        selection.pointer_down(2, 2, false, true);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1:B2")]);
        assert_eq!(selection.cursor, "A1".into());
    }
}
