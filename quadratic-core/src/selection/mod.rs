//! The current selected cells in a sheet.

use std::{collections::HashSet, str::FromStr};

use crate::{Pos, Rect, SheetPos, SheetRect, grid::SheetId};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

mod selection_create;

/// **Deprecated** Nov 2024 in favor of [`crate::A1Selection`].
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, TS)]
pub struct OldSelection {
    pub sheet_id: SheetId,

    // cursor position
    pub x: i64,
    pub y: i64,

    pub rects: Option<Vec<Rect>>,
    pub rows: Option<Vec<i64>>,
    pub columns: Option<Vec<i64>>,
    pub all: bool,
}

impl Default for OldSelection {
    fn default() -> Self {
        OldSelection {
            sheet_id: SheetId::TEST,
            x: 1,
            y: 1,
            rects: None,
            rows: None,
            columns: None,
            all: false,
        }
    }
}
impl OldSelection {
    pub fn has_sheet_selection(&self) -> bool {
        self.rows.is_some() || self.columns.is_some() || self.all
    }

    pub fn source(&self) -> Pos {
        Pos {
            x: self.x,
            y: self.y,
        }
    }

    /// Counts the number of entries needed for the selection (includes both
    /// sheet- and cell-based selections)
    pub fn count(&self) -> usize {
        if self.all {
            return 1;
        }

        let mut count = 0;
        if let Some(ref columns) = self.columns {
            count += columns.len();
        }
        if let Some(ref rows) = self.rows {
            count += rows.len();
        }
        if let Some(ref rects) = self.rects {
            let sum = rects.iter().map(|rect| rect.count()).sum::<usize>();
            count += sum;
        }
        count
    }

    /// Counts the number of (sheet-based parts, cell-based parts)
    pub fn count_parts(&self) -> (usize, usize) {
        if self.all {
            return (1, 0);
        }
        let mut sheet_count = 0;
        let mut cell_count = 0;
        if let Some(columns) = self.columns.as_ref() {
            sheet_count += columns.len();
        }
        if let Some(rows) = self.rows.as_ref() {
            sheet_count += rows.len();
        }
        if let Some(ref rects) = self.rects {
            cell_count = rects.iter().map(|rect| rect.count()).sum::<usize>();
        }
        (sheet_count, cell_count)
    }

    /// Gets the encompassing rect for selection.rects. Returns None if there are no rects.
    pub fn largest_rect(&self) -> Option<SheetRect> {
        if let Some(rects) = self.rects.as_ref() {
            let mut min_x = i64::MAX;
            let mut max_x = i64::MIN;
            let mut min_y = i64::MAX;
            let mut max_y = i64::MIN;
            rects.iter().for_each(|rect| {
                min_x = min_x.min(rect.min.x);
                max_x = max_x.max(rect.max.x);
                min_y = min_y.min(rect.min.y);
                max_y = max_y.max(rect.max.y);
            });
            if min_x != i64::MAX && min_y != i64::MAX && max_x != i64::MIN && max_y != i64::MIN {
                Some(SheetRect {
                    sheet_id: self.sheet_id,
                    min: Pos { x: min_x, y: min_y },
                    max: Pos { x: max_x, y: max_y },
                })
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Returns whether a position is located inside a selection. If only_rects
    /// is true, then it will only check Selection.rects and ignore all,
    /// columns, and rows.
    pub fn contains_pos(&self, pos: Pos) -> bool {
        if self.all {
            return true;
        }

        if let Some(columns) = self.columns.as_ref()
            && columns.contains(&pos.x) {
                return true;
            }

        if let Some(rows) = self.rows.as_ref()
            && rows.contains(&pos.y) {
                return true;
            }

        if let Some(rects) = self.rects.as_ref()
            && rects.iter().any(|rect| rect.contains(pos)) {
                return true;
            }
        false
    }

    /// Returns whether a column is located inside a selection.
    pub fn contains_column(&self, x: i64) -> bool {
        if let Some(columns) = self.columns.as_ref() {
            return columns.contains(&x);
        }
        false
    }

    /// Returns whether a row is located inside a selection.
    pub fn contains_row(&self, y: i64) -> bool {
        if let Some(rows) = self.rows.as_ref() {
            return rows.contains(&y);
        }
        false
    }

    /// Returns whether a rect is located inside the Selection.rects. Note: this
    /// ignores the Selection.all, columns, and rows.
    pub fn in_rects(&self, rect: Rect) -> bool {
        if let Some(rects) = self.rects.as_ref() {
            return rects.iter().any(|r| r.intersects(rect));
        }
        false
    }

    /// Gets the origin.
    pub fn origin(&self) -> SheetPos {
        SheetPos {
            x: self.x,
            y: self.y,
            sheet_id: self.sheet_id,
        }
    }

    /// Translates the selection in place.
    pub fn translate_in_place(&mut self, delta_x: i64, delta_y: i64) {
        self.x += delta_x;
        self.y += delta_y;
        if let Some(columns) = self.columns.as_mut() {
            for x in columns {
                *x += delta_x;
            }
        }
        if let Some(rows) = self.rows.as_mut() {
            for y in rows {
                *y += delta_y;
            }
        }
        if let Some(rects) = self.rects.as_mut() {
            for rect in rects {
                rect.min.x += delta_x;
                rect.min.y += delta_y;
                rect.max.x += delta_x;
                rect.max.y += delta_y;
            }
        }
    }

    // Translates the selection and returns a new selection.
    pub fn translate(&self, delta_x: i64, delta_y: i64) -> OldSelection {
        let mut selection = self.clone();
        selection.translate_in_place(delta_x, delta_y);
        selection
    }

    /// Determines whether the Selection is empty.
    pub fn is_empty(&self) -> bool {
        !self.all
            && (self.columns.is_none()
                || self
                    .columns
                    .as_ref()
                    .is_some_and(|columns| columns.is_empty()))
            && (self.rows.is_none() || self.rows.as_ref().is_some_and(|rows| rows.is_empty()))
            && (self.rects.is_none() || self.rects.as_ref().is_some_and(|rects| rects.is_empty()))
    }

    /// Finds intersection of two Selections. Note: x,y of the resulting
    /// Selection is defined as self.x and self.y (mostly not useful).
    pub fn intersection(&self, other: &OldSelection) -> Option<OldSelection> {
        if self.sheet_id != other.sheet_id {
            return None;
        }
        let all = self.all && other.all;
        let rows = if let (Some(rows), Some(other_rows)) = (&self.rows, &other.rows) {
            Some(
                rows.iter()
                    .filter(|r| other_rows.contains(r))
                    .cloned()
                    .collect(),
            )
        } else {
            None
        };
        let columns = if let (Some(columns), Some(other_columns)) = (&self.columns, &other.columns)
        {
            Some(
                columns
                    .iter()
                    .filter(|c| other_columns.contains(c))
                    .cloned()
                    .collect(),
            )
        } else {
            None
        };
        let rects = if let (Some(rects), Some(other_rects)) = (&self.rects, &other.rects) {
            let mut new_rects = Vec::new();
            for rect in rects {
                for other_rect in other_rects {
                    if let Some(intersect) = rect.intersection(other_rect) {
                        new_rects.push(intersect);
                    }
                }
            }
            if new_rects.is_empty() {
                None
            } else {
                Some(new_rects)
            }
        } else {
            None
        };
        let selection = OldSelection {
            sheet_id: self.sheet_id,
            x: self.x,
            y: self.y,
            all,
            rows,
            columns,
            rects,
        };
        if selection.is_empty() {
            None
        } else {
            Some(selection)
        }
    }

    /// Potentially grows the selection to include a new column.
    pub fn inserted_column(&mut self, column: i64) -> bool {
        let mut changed = false;
        // increment any columns greater than the inserted column
        self.columns = self.columns.as_mut().map(|column_in_vec| {
            column_in_vec
                .iter()
                .map(|c| {
                    if *c >= column {
                        changed = true;
                        *c + 1
                    } else {
                        *c
                    }
                })
                .collect()
        });

        // insert the new column into any selection rects
        if let Some(rects) = self.rects.as_mut() {
            for rect in rects.iter_mut() {
                if rect.min.x >= column {
                    rect.min.x += 1;
                    changed = true;
                }
                if rect.max.x >= column {
                    rect.max.x += 1;
                    changed = true;
                }
            }
        }

        changed
    }

    /// Potentially grows the selection to include a new row.
    pub fn inserted_row(&mut self, row: i64) -> bool {
        let mut changed = false;

        // increment any rows greater than the inserted row
        self.rows = self.rows.as_mut().map(|row_in_vec| {
            row_in_vec
                .iter()
                .map(|r| {
                    if *r >= row {
                        changed = true;
                        *r + 1
                    } else {
                        *r
                    }
                })
                .collect()
        });

        // insert the new row into any selection rects
        if let Some(rects) = self.rects.as_mut() {
            for rect in rects.iter_mut() {
                if rect.min.y >= row {
                    rect.min.y += 1;
                    changed = true;
                }
                if rect.max.y >= row {
                    rect.max.y += 1;
                    changed = true;
                }
            }
        }

        changed
    }

    /// Potentially shrinks a selection after the removal of a column.
    pub fn removed_column(&mut self, column: i64) -> bool {
        let mut changed = false;

        // decrement any columns greater than the removed column
        self.columns = self.columns.as_mut().map(|column_in_vec| {
            column_in_vec
                .iter()
                .filter_map(|c| match c.cmp(&column) {
                    std::cmp::Ordering::Equal => {
                        changed = true;
                        None
                    }
                    std::cmp::Ordering::Greater => {
                        changed = true;
                        Some(*c - 1)
                    }
                    std::cmp::Ordering::Less => Some(*c),
                })
                .collect()
        });
        if self
            .columns
            .as_ref()
            .is_some_and(|columns| columns.is_empty())
        {
            self.columns = None;
        }

        // remove the column from any selection rects
        if let Some(rects) = self.rects.as_mut() {
            rects.retain_mut(|rect| {
                if rect.min.x >= column {
                    rect.min.x -= 1;
                    changed = true;
                }
                if rect.max.x >= column {
                    rect.max.x -= 1;
                    changed = true;
                }
                rect.width() > 0 && rect.height() > 0
            });
        }

        changed
    }

    /// Potentially shrinks a selection after the removal of a row.
    pub fn removed_row(&mut self, row: i64) -> bool {
        let mut changed = false;

        // decrement any rows greater than the removed row
        self.rows = self.rows.as_mut().map(|row_in_vec| {
            row_in_vec
                .iter()
                .filter_map(|r| match r.cmp(&row) {
                    std::cmp::Ordering::Equal => {
                        changed = true;
                        None
                    }
                    std::cmp::Ordering::Greater => {
                        changed = true;
                        Some(*r - 1)
                    }
                    std::cmp::Ordering::Less => Some(*r),
                })
                .collect()
        });
        if self.rows.as_ref().is_some_and(|rows| rows.is_empty()) {
            self.rows = None;
        }

        // remove the row from any selection rects
        if let Some(rects) = self.rects.as_mut() {
            rects.retain_mut(|rect| {
                if rect.min.y >= row {
                    rect.min.y -= 1;
                    changed = true;
                }
                if rect.max.y >= row {
                    rect.max.y -= 1;
                    changed = true;
                }
                rect.width() > 0 && rect.height() > 0
            });
        }

        changed
    }

    /// Converts the rects in a selection to a set of quadrant positions.
    pub fn rects_to_hashes(&self) -> HashSet<Pos> {
        let mut hashes = HashSet::new();
        if let Some(rects) = self.rects.as_ref() {
            for rect in rects {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        let mut pos = Pos { x, y };
                        pos.to_quadrant();
                        hashes.insert(pos);
                    }
                }
            }
        }
        hashes
    }

    /// Adds a rect to the selection.
    pub fn add_rect(&mut self, rect: Rect) {
        if self.all {
            self.all = false;
        }
        if let Some(rects) = &mut self.rects {
            rects.push(rect);
        } else {
            self.rects = Some(vec![rect]);
        }
    }

    /// Adds column(s) to the selection. Also fixes the ordering and removes
    /// duplicates.
    pub fn add_columns(&mut self, columns: Vec<i64>) {
        if self.all {
            self.all = false;
        }
        let mut new_columns = columns;
        new_columns.sort_unstable();
        new_columns.dedup();
        if let Some(existing_columns) = &mut self.columns {
            existing_columns.extend(new_columns);
            existing_columns.sort_unstable();
            existing_columns.dedup();
        } else {
            self.columns = Some(new_columns);
        }
    }

    /// Adds row(s) to the selection. Also fixes the ordering and removes
    /// duplicates.
    pub fn add_rows(&mut self, rows: Vec<i64>) {
        if self.all {
            self.all = false;
        }
        let mut new_rows = rows;
        new_rows.sort_unstable();
        new_rows.dedup();
        if let Some(existing_rows) = &mut self.rows {
            existing_rows.extend(new_rows);
            existing_rows.sort_unstable();
            existing_rows.dedup();
        } else {
            self.rows = Some(new_rows);
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_largest_rect() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection {
            sheet_id,
            all: true,
            ..Default::default()
        };
        assert_eq!(selection.largest_rect(), None);

        let selection = OldSelection {
            sheet_id,
            rows: Some(vec![1, 2, 3]),
            ..Default::default()
        };
        assert_eq!(selection.largest_rect(), None);

        let selection = OldSelection {
            sheet_id,
            columns: Some(vec![1, 2, 3]),
            ..Default::default()
        };
        assert_eq!(selection.largest_rect(), None);

        let selection = OldSelection {
            sheet_id,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            ..Default::default()
        };
        assert_eq!(
            selection.largest_rect(),
            Some(SheetRect::from_numbers(1, 2, 3, 4, sheet_id))
        );
    }

    #[test]
    fn test_pos_in_selection() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection {
            sheet_id,
            all: true,
            ..Default::default()
        };
        assert!(selection.contains_pos(Pos { x: 0, y: 0 }));

        let selection = OldSelection {
            sheet_id,
            rows: Some(vec![1, 2, 3]),
            ..Default::default()
        };
        assert!(selection.contains_pos(Pos { x: 0, y: 1 }));
        assert!(!selection.contains_pos(Pos { x: 0, y: 4 }));

        let selection = OldSelection {
            sheet_id,
            columns: Some(vec![1, 2, 3]),
            rows: Some(vec![10]),
            ..Default::default()
        };
        assert!(selection.contains_pos(Pos { x: 2, y: 0 }));
        assert!(selection.contains_pos(Pos { x: -5, y: 10 }));
        assert!(!selection.contains_pos(Pos { x: 4, y: 0 }));

        let selection = OldSelection {
            sheet_id,
            columns: Some(vec![5]),
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            ..Default::default()
        };
        assert!(selection.contains_pos(Pos { x: 1, y: 2 }));
        assert!(!selection.contains_pos(Pos { x: 4, y: 4 }));
        assert!(selection.contains_pos(Pos { x: 5, y: 5 }));
    }

    #[test]
    fn test_origin() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection {
            sheet_id,
            x: 1,
            y: 2,
            ..Default::default()
        };
        assert_eq!(
            selection.origin(),
            SheetPos {
                x: 1,
                y: 2,
                sheet_id
            }
        );
    }

    #[test]
    fn test_translate() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection {
            sheet_id,
            x: 1,
            y: 2,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            columns: Some(vec![1, 2, 3]),
            rows: Some(vec![4, 5, 6]),
            ..Default::default()
        };
        let delta_x = 1 - 2;
        let delta_y = 2 - 3;
        let translated = selection.translate(delta_x, delta_y);
        assert_eq!(
            translated,
            OldSelection {
                sheet_id,
                x: 0,
                y: 1,
                rects: Some(vec![Rect::from_numbers(1 + delta_x, 2 + delta_y, 3, 4)]),
                columns: Some(vec![1 + delta_x, 2 + delta_x, 3 + delta_x]),
                rows: Some(vec![4 + delta_y, 5 + delta_y, 6 + delta_y]),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_count() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection {
            sheet_id,
            x: 1,
            y: 2,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            columns: Some(vec![1, 2, 3]),
            rows: Some(vec![4, 5, 6]),
            all: false,
        };
        assert_eq!(selection.count(), 18);

        let selection = OldSelection {
            sheet_id,
            x: 1,
            y: 2,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            columns: Some(vec![1, 2, 3]),
            rows: Some(vec![4, 5, 6]),
            all: true,
        };

        // all is always count = 1
        assert_eq!(selection.count(), 1);
    }

    #[test]
    fn test_selection_columns() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection::columns(&[1, 2, 3], sheet_id);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id,
                columns: Some(vec![1, 2, 3]),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_selection_rows() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection::rows(&[1, 2, 3], sheet_id);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id,
                rows: Some(vec![1, 2, 3]),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_contains_column() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection::columns(&[1, 2, 3], sheet_id);
        assert!(selection.contains_column(1));
        assert!(!selection.contains_column(4));
    }

    #[test]
    fn test_contains_row() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection::rows(&[1, 2, 3], sheet_id);
        assert!(selection.contains_row(1));
        assert!(!selection.contains_row(4));
    }

    #[test]
    fn test_in_rect() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            rows: None,
            columns: None,
            all: false,
        };
        assert!(selection.in_rects(Rect::from_numbers(1, 2, 3, 4)));
        assert!(!selection.in_rects(Rect::from_numbers(4, 5, 6, 7)));
    }

    #[test]
    fn test_is_empty() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            rows: None,
            columns: None,
            all: false,
        };
        assert!(!selection.is_empty());

        let selection = OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            rows: None,
            columns: None,
            all: false,
        };
        assert!(selection.is_empty());
    }

    #[test]
    fn test_translate_in_place() {
        let sheet_id = SheetId::TEST;
        let mut selection = OldSelection {
            sheet_id,
            x: 1,
            y: 2,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            columns: Some(vec![1, 2, 3]),
            rows: Some(vec![4, 5, 6]),
            all: false,
        };
        selection.translate_in_place(1, 2);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id,
                x: 2,
                y: 4,
                rects: Some(vec![Rect::from_numbers(2, 4, 3, 4)]),
                columns: Some(vec![2, 3, 4]),
                rows: Some(vec![6, 7, 8]),
                all: false
            }
        );
    }

    #[test]
    fn test_intersection() {
        let sheet_id = SheetId::TEST;
        let selection1 = OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            columns: Some(vec![1, 2, 3]),
            rows: Some(vec![4, 5, 6]),
            all: false,
        };
        let selection2 = OldSelection {
            sheet_id,
            x: 1,
            y: 2,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            columns: Some(vec![1, 2, 3]),
            rows: Some(vec![4, 5, 6]),
            all: false,
        };
        let intersection = selection1.intersection(&selection2).unwrap();
        assert_eq!(
            intersection,
            OldSelection {
                sheet_id,
                x: 0,
                y: 0,
                rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
                columns: Some(vec![1, 2, 3]),
                rows: Some(vec![4, 5, 6]),
                all: false
            }
        );

        let selection2 = OldSelection {
            sheet_id,
            x: 1,
            y: 2,
            rects: Some(vec![Rect::from_numbers(4, 5, 6, 7)]),
            columns: None,
            rows: None,
            all: false,
        };
        let intersection = selection1.intersection(&selection2);
        assert!(intersection.is_none());
    }

    #[test]
    fn test_count_parts() {
        let sheet_id = SheetId::TEST;
        let selection = OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![Rect::from_numbers(1, 2, 3, 4)]),
            columns: Some(vec![1, 2, 3]),
            rows: Some(vec![4, 5, 6]),
            all: false,
        };
        assert_eq!(selection.count_parts(), (6, 12));

        let selection_all = OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            columns: None,
            rows: None,
            all: true,
        };
        assert_eq!(selection_all.count_parts(), (1, 0));

        let selection_only_rects = OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: Some(vec![
                Rect::from_numbers(1, 2, 3, 4),
                Rect::from_numbers(5, 6, 2, 2),
            ]),
            columns: None,
            rows: None,
            all: false,
        };
        assert_eq!(selection_only_rects.count_parts(), (0, 16));

        let selection_empty = OldSelection {
            sheet_id,
            x: 0,
            y: 0,
            rects: None,
            columns: None,
            rows: None,
            all: false,
        };
        assert_eq!(selection_empty.count_parts(), (0, 0));
    }

    #[test]
    fn test_inserted_column() {
        let sheet_id = SheetId::TEST;
        let mut selection = OldSelection {
            sheet_id,
            columns: Some(vec![1, 2, 3]),
            rects: Some(vec![Rect::new(1, 1, 3, 3), Rect::new(-10, -10, 1, 1)]),
            ..Default::default()
        };
        assert!(selection.inserted_column(2));
        assert_eq!(
            selection,
            OldSelection {
                sheet_id,
                columns: Some(vec![1, 3, 4]),
                rects: Some(vec![Rect::new(1, 1, 4, 3), Rect::new(-10, -10, 1, 1)]),
                ..Default::default()
            }
        );
        assert!(!selection.inserted_column(10));
    }

    #[test]
    fn test_inserted_row() {
        let sheet_id = SheetId::TEST;
        let mut selection = OldSelection {
            sheet_id,
            rows: Some(vec![1, 2, 3]),
            rects: Some(vec![Rect::new(1, 1, 3, 3), Rect::new(-10, -10, 1, 1)]),
            ..Default::default()
        };
        selection.inserted_row(2);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id,
                rows: Some(vec![1, 3, 4]),
                rects: Some(vec![Rect::new(1, 1, 3, 4), Rect::new(-10, -10, 1, 1)]),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_removed_column() {
        let sheet_id = SheetId::TEST;
        let mut selection = OldSelection {
            sheet_id,
            columns: Some(vec![1, 2, 3]),
            rects: Some(vec![Rect::new(1, 1, 3, 3), Rect::new(-10, -10, 1, 1)]),
            ..Default::default()
        };
        selection.removed_column(2);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id,
                columns: Some(vec![1, 2]),
                rects: Some(vec![Rect::new(1, 1, 2, 3), Rect::new(-10, -10, 1, 1)]),
                ..Default::default()
            }
        );

        let mut selection = OldSelection {
            sheet_id,
            columns: Some(vec![1]),
            ..Default::default()
        };
        selection.removed_column(1);
        assert!(selection.columns.is_none());
    }

    #[test]
    fn test_removed_row() {
        let sheet_id = SheetId::TEST;
        let mut selection = OldSelection {
            sheet_id,
            rows: Some(vec![1, 2, 3]),
            rects: Some(vec![Rect::new(1, 1, 3, 3), Rect::new(-10, -10, 1, 1)]),
            ..Default::default()
        };
        selection.removed_row(2);
        assert_eq!(
            selection,
            OldSelection {
                sheet_id,
                rows: Some(vec![1, 2]),
                rects: Some(vec![Rect::new(1, 1, 3, 2), Rect::new(-10, -10, 1, 1)]),
                ..Default::default()
            }
        );

        let mut selection = OldSelection {
            sheet_id,
            rows: Some(vec![1]),
            ..Default::default()
        };
        selection.removed_row(1);
        assert!(selection.rows.is_none());
    }

    #[test]
    fn test_rects_to_hashes() {
        let selection = OldSelection {
            sheet_id: SheetId::TEST,
            rects: Some(vec![Rect::new(1, 1, 3, 3), Rect::new(-3, -3, -1, -1)]),
            ..Default::default()
        };
        assert_eq!(
            selection.rects_to_hashes(),
            HashSet::from([Pos { x: -1, y: -1 }, Pos { x: 0, y: 0 }])
        );
    }

    #[test]
    fn test_add_rect() {
        let mut selection = OldSelection::default();
        selection.add_rect(Rect::new(1, 1, 3, 3));
        assert_eq!(
            selection,
            OldSelection {
                rects: Some(vec![Rect::new(1, 1, 3, 3)]),
                ..Default::default()
            }
        );

        selection.add_rect(Rect::new(4, 4, 6, 6));
        assert_eq!(
            selection,
            OldSelection {
                rects: Some(vec![Rect::new(1, 1, 3, 3), Rect::new(4, 4, 6, 6)]),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_add_columns() {
        let mut selection = OldSelection::default();
        selection.add_columns(vec![1, 2, 3]);
        assert_eq!(
            selection,
            OldSelection {
                columns: Some(vec![1, 2, 3]),
                x: 1,
                ..Default::default()
            }
        );

        selection.add_columns(vec![4, 5, 6]);
        assert_eq!(
            selection,
            OldSelection {
                columns: Some(vec![1, 2, 3, 4, 5, 6]),
                x: 1,
                ..Default::default()
            }
        );

        selection.add_columns(vec![5, 6, 4]);
        assert_eq!(
            selection,
            OldSelection {
                columns: Some(vec![1, 2, 3, 4, 5, 6]),
                ..Default::default()
            }
        );
    }

    #[test]
    fn test_add_rows() {
        let mut selection = OldSelection::default();
        selection.add_rows(vec![1, 2, 3]);
        assert_eq!(
            selection,
            OldSelection {
                rows: Some(vec![1, 2, 3]),
                ..Default::default()
            }
        );

        selection.add_rows(vec![5, 4, 6]);
        assert_eq!(
            selection,
            OldSelection {
                rows: Some(vec![1, 2, 3, 4, 5, 6]),
                ..Default::default()
            }
        );
    }
}
