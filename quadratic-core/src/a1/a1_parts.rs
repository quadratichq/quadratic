//! A1Parts is a struct that represents the parts of an A1 string. It is used to
//! parse and and then stringify an A1 string (eg, after a translate).

use crate::{Pos, Rect};

use super::{A1Error, A1};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RelColRowRange {
    pub from: RelColRow,
    pub to: RelColRow,
}

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct RelColRow {
    pub index: u64,
    pub relative: bool,
}

#[derive(Debug, PartialEq)]
pub struct RelPos {
    pub x: u64,
    pub y: u64,
    pub relative_x: bool,
    pub relative_y: bool,
}
impl From<RelPos> for Pos {
    fn from(pos: RelPos) -> Self {
        Pos {
            x: pos.x as i64,
            y: pos.y as i64,
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct RelRect {
    pub min: RelPos,
    pub max: RelPos,
}

impl From<RelRect> for Rect {
    fn from(rect: RelRect) -> Self {
        Rect {
            min: rect.min.into(),
            max: rect.max.into(),
        }
    }
}

#[derive(Debug, Default)]
pub struct A1Parts {
    pub sheet_name: Option<String>,
    pub all: bool,
    pub columns: Vec<RelColRow>,
    pub column_ranges: Vec<RelColRowRange>,
    pub rows: Vec<RelColRow>,
    pub row_ranges: Vec<RelColRowRange>,
    pub rects: Vec<RelRect>,
    pub positions: Vec<RelPos>,
}

impl A1Parts {
    pub fn from_a1(a1: &str) -> Result<Self, A1Error> {
        let mut parts = A1Parts::default();
        let mut a1 = a1;

        // Get the sheet name if present
        let (remaining, sheet_name) = A1::try_sheet_name(a1)?;
        parts.sheet_name = sheet_name.map(|x| x.to_string());
        a1 = remaining;

        for part in a1.split(',') {
            let part = part.trim();

            if A1::try_from_all(part) {
                parts.all = true;

                // if it's all, then we return that
                return Ok(parts);
            }

            if let Some(column) = A1::try_from_column_relative(part) {
                parts.columns.push(column);
            }

            if let Some(row) = A1::try_from_row_relative(part) {
                parts.rows.push(row);
            }

            if let Some(column_range) = A1::try_from_column_range_relative(part) {
                parts.column_ranges.push(column_range);
            }

            if let Some(row_range) = A1::try_from_row_range_relative(part) {
                parts.row_ranges.push(row_range);
            }

            // Get the rects
            if let Some(rects) = A1::try_from_range_relative(part) {
                parts.rects.push(rects);
            }

            // Get the positions
            if let Some(positions) = A1::try_from_pos_relative(part) {
                parts.positions.push(positions);
            }
        }

        Ok(parts)
    }

    /// Translates A1Parts by a delta.
    pub fn translate(&mut self, delta_x: u64, delta_y: u64) {
        for column in &mut self.columns {
            if column.relative {
                column.index += delta_x;
            }
        }

        for row in &mut self.rows {
            if row.relative {
                row.index += delta_y;
            }
        }

        for column_range in &mut self.column_ranges {
            if column_range.from.relative {
                column_range.from.index += delta_x;
            }

            if column_range.to.relative {
                column_range.to.index += delta_x;
            }
        }

        for row_range in &mut self.row_ranges {
            if row_range.from.relative {
                row_range.from.index += delta_y;
            }

            if row_range.to.relative {
                row_range.to.index += delta_y;
            }
        }

        for rect in &mut self.rects {
            if rect.min.relative_x {
                rect.min.x += delta_x;
            }

            if rect.min.relative_y {
                rect.min.y += delta_y;
            }

            if rect.max.relative_x {
                rect.max.x += delta_x;
            }

            if rect.max.relative_y {
                rect.max.y += delta_y;
            }
        }

        for pos in &mut self.positions {
            if pos.relative_x {
                pos.x += delta_x;
            }

            if pos.relative_y {
                pos.y += delta_y;
            }
        }
    }
}

impl From<A1Parts> for String {
    fn from(parts: A1Parts) -> Self {
        let mut results = vec![];

        let sheet_name = if let Some(sheet_name) = parts.sheet_name {
            format!("{}!", sheet_name)
        } else {
            "".to_string()
        };

        // if it's all, we can strip out the rest of it (for now--maybe with tables this changes)
        if parts.all {
            return format!("{}{}", sheet_name, "*");
        }

        results.extend(parts.columns.iter().map(|column| {
            format!(
                "{}{}",
                if column.relative { "$" } else { "" },
                A1::x_to_a1(column.index)
            )
        }));

        results.extend(
            parts
                .rows
                .iter()
                .map(|row| format!("{}{}", if row.relative { "" } else { "$" }, row.index)),
        );

        results.extend(parts.column_ranges.iter().map(|range| {
            format!(
                "{}{}:{}{}",
                if range.from.relative { "" } else { "$" },
                A1::x_to_a1(range.from.index),
                if range.to.relative { "" } else { "$" },
                A1::x_to_a1(range.to.index)
            )
        }));

        results.extend(parts.row_ranges.iter().map(|range| {
            format!(
                "{}{}:{}{}",
                if range.from.relative { "" } else { "$" },
                range.from.index,
                if range.to.relative { "" } else { "$" },
                range.to.index
            )
        }));

        results.extend(parts.rects.iter().map(|rect| {
            format!(
                "{}{}{}{}:{}{}{}{}",
                if rect.min.relative_x { "" } else { "$" },
                A1::x_to_a1(rect.min.x),
                if rect.min.relative_y { "" } else { "$" },
                rect.min.y,
                if rect.max.relative_x { "" } else { "$" },
                A1::x_to_a1(rect.max.x),
                if rect.max.relative_y { "" } else { "$" },
                rect.max.y
            )
        }));

        results.extend(parts.positions.iter().map(|pos| {
            format!(
                "{}{}{}{}",
                if pos.relative_x { "" } else { "$" },
                A1::x_to_a1(pos.x),
                if pos.relative_y { "" } else { "$" },
                pos.y
            )
        }));

        format!("{}{}", sheet_name, results.join(","))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_a1() {
        let parts = A1Parts::from_a1("Sheet1!A1:B2,$C$3,D:E,4:5").unwrap();
        assert_eq!(parts.sheet_name, Some("Sheet1".to_string()));
        assert_eq!(parts.rects.len(), 1);
        assert_eq!(parts.positions.len(), 1);
        assert_eq!(parts.column_ranges.len(), 1);
        assert_eq!(parts.row_ranges.len(), 1);
    }

    #[test]
    fn test_translate() {
        let mut parts = A1Parts::from_a1("Sheet 3!A1,$B$2,C:D,3:4").unwrap();
        parts.translate(1, 1);
        assert_eq!(String::from(parts), "Sheet 3!D:E,4:5,B2,$B$2");
    }

    #[test]
    fn test_from_string() {
        let parts = A1Parts::from_a1("*").unwrap();
        assert!(parts.all);

        let parts = A1Parts::from_a1("A1,B2:C3").unwrap();
        assert_eq!(parts.positions.len(), 1);
        assert_eq!(parts.rects.len(), 1);
    }

    #[test]
    fn test_to_string() {
        let parts = A1Parts::from_a1("Sheet1!A1,$B$2,C:D,3:4").unwrap();
        assert_eq!(String::from(parts), "Sheet1!C:D,3:4,A1,$B$2");
    }
}
