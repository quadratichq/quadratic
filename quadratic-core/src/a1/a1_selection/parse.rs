use crate::a1::{A1Context, A1Error, SheetCellRefRange};

use super::*;

impl A1Selection {
    /// Parses a selection from a comma-separated list of ranges.
    ///
    /// Returns an error if ranges refer to different sheets. Ranges without an
    /// explicit sheet use `default_sheet_id`.
    pub fn parse(
        a1: &str,
        default_sheet_id: &SheetId,
        context: &A1Context,
    ) -> Result<Self, A1Error> {
        let mut sheet = None;
        let mut ranges = vec![];

        let mut segments = Vec::new();
        let mut current_segment = String::new();
        let mut in_quotes = false;
        let mut in_table = 0;

        for (i, c) in a1.trim().chars().enumerate() {
            match c {
                '[' => {
                    if !in_quotes && i != 0 && a1.chars().nth(i - 1).unwrap() != '\'' {
                        in_table += 1;
                        current_segment.push(c);
                    }
                }
                ']' => {
                    if !in_quotes && i != 0 && a1.chars().nth(i - 1).unwrap() != '\'' {
                        in_table -= 1;
                        current_segment.push(c);
                    }
                }
                '\'' => {
                    if in_table == 0 {
                        if !in_quotes && i > 0 {
                            return Err(A1Error::InvalidSheetName(a1.to_string()));
                        }
                        in_quotes = !in_quotes;
                        current_segment.push(c);
                    }
                }
                ',' => {
                    if in_quotes || in_table != 0 {
                        current_segment.push(c);
                    } else if !current_segment.is_empty() {
                        segments.push(current_segment);
                        current_segment = String::new();
                    }
                }
                _ => current_segment.push(c),
            }
        }
        if !current_segment.is_empty() {
            segments.push(current_segment);
        }

        for segment in segments {
            let range = SheetCellRefRange::parse(segment.trim(), default_sheet_id, context)?;
            if *sheet.get_or_insert(range.sheet_id) != range.sheet_id {
                return Err(A1Error::TooManySheets(a1.to_string()));
            }

            ranges.push(range.cells);
        }

        let last_range = ranges
            .last()
            .ok_or_else(|| A1Error::InvalidRange(a1.to_string()))?;

        Ok(Self {
            sheet_id: sheet.unwrap_or(default_sheet_id.to_owned()),
            cursor: Self::cursor_pos_from_last_range(last_range, context),
            ranges,
        })
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_from_a1() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        assert_eq!(
            A1Selection::parse("A1", &sheet_id, &context),
            Ok(A1Selection::from_xy(1, 1, sheet_id)),
        );
    }

    #[test]
    fn test_from_a1_all() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        assert_eq!(
            A1Selection::parse("*", &sheet_id, &context),
            Ok(A1Selection::from_range(
                CellRefRange::ALL,
                sheet_id,
                &context
            )),
        );
    }

    #[test]
    fn test_from_a1_rect() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        assert_eq!(
            A1Selection::parse("A1:B2", &sheet_id, &context),
            Ok(A1Selection::test_a1("A1:B2")),
        );
        assert_eq!(
            A1Selection::parse("D1:A5", &sheet_id, &context),
            Ok(A1Selection::test_a1("D1:A5")),
        );
        assert_eq!(
            A1Selection::parse("A1:B2,D1:A5", &sheet_id, &context),
            Ok(A1Selection::test_a1("A1:B2,D1:A5")),
        );
    }

    #[test]
    fn test_from_a1_everything() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        let selection =
            A1Selection::parse("A1,B1:D2,E:G,2:3,5:7,F6:G8,4", &sheet_id, &context).unwrap();

        assert_eq!(selection.sheet_id, sheet_id);
        assert_eq!(selection.cursor, pos![A4]);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::new_relative_pos(Pos { x: 1, y: 1 }),
                CellRefRange::new_relative_rect(Rect::new(2, 1, 4, 2)),
                CellRefRange::new_relative_column_range(5, 7),
                CellRefRange::new_relative_row_range(2, 3),
                CellRefRange::new_relative_row_range(5, 7),
                CellRefRange::new_relative_rect(Rect::new(6, 6, 7, 8)),
                CellRefRange::new_relative_row(4),
            ],
        );
    }

    #[test]
    fn test_row_to_a1() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        assert_eq!(
            A1Selection::parse("1", &sheet_id, &context),
            Ok(A1Selection::from_range(
                CellRefRange::new_relative_row(1),
                sheet_id,
                &context,
            )),
        );

        assert_eq!(
            A1Selection::parse("1:3", &sheet_id, &context),
            Ok(A1Selection::test_a1("1:3")),
        );

        assert_eq!(
            A1Selection::parse("1:", &sheet_id, &context),
            Ok(A1Selection::test_a1("*")),
        );
    }

    #[test]
    fn test_from_a1_sheets() {
        let sheet_id = SheetId::new();
        let sheet_id2 = SheetId::new();
        let context = A1Context::test(&[("Sheet1", sheet_id), ("Second", sheet_id2)], &[]);
        assert_eq!(
            A1Selection::parse("'Second'!A1", &sheet_id, &context),
            Ok(A1Selection::from_xy(1, 1, sheet_id2)),
        );
    }

    #[test]
    fn test_invalid_sheet_name() {
        let sheet_id = SheetId::test();
        let context = A1Context::default();
        assert_eq!(
            A1Selection::parse("Sheet' 1'!A1", &sheet_id, &context),
            Err(A1Error::InvalidSheetName("Sheet' 1'!A1".to_string())),
        );
    }

    #[test]
    fn test_a1_parse_table() {
        let sheet_id = SheetId::test();
        let context = A1Context::test(
            &[("First", sheet_id)],
            &[("test_table", &["Col1"], Rect::test_a1("A1:C3"))],
        );
        assert_eq!(
            A1Selection::parse(
                "test_table[[#DATA],[#HEADERS],[Col1]],A1",
                &sheet_id,
                &context
            )
            .unwrap()
            .to_string(Some(sheet_id), &context),
            "test_table[[#DATA],[#HEADERS],[Col1]],A1".to_string(),
        );

        let context = A1Context::test(
            &[("First", sheet_id)],
            &[("test_table-2.csv", &["Col1"], Rect::test_a1("A1:C3"))],
        );
        assert_eq!(
            A1Selection::parse("test_table-2.csv[Col1]", &sheet_id, &context)
                .unwrap()
                .to_string(Some(sheet_id), &context),
            "test_table-2.csv[Col1]".to_string(),
        );
    }
}