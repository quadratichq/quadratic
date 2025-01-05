//! Tokenizes a table reference after the table_name has been removed.

use crate::a1::UNBOUNDED;

use super::*;

#[derive(Debug, PartialEq, Clone)]
pub(crate) enum Token {
    All,
    Headers,
    Data,
    Totals,
    ThisRow,
    Column(String),
    ColumnRange(String, String),
    ColumnToEnd(String),
    RowRange(i64, i64),
}

impl TableRef {
    /// Tokenizes rows.
    fn tokenize_rows(s: &str) -> Result<Token, A1Error> {
        let s = s.trim().to_ascii_uppercase();

        // Handle single number case
        if let Ok(num) = s.parse::<i64>() {
            return Ok(Token::RowRange(num, num));
        }

        if s == "LAST" {
            return Ok(Token::RowRange(UNBOUNDED, UNBOUNDED));
        }

        if s == "THIS ROW" {
            return Ok(Token::ThisRow);
        }

        // Handle range cases (contains ':')
        if let Some((start, end)) = s.split_once(':') {
            let start = start.trim();
            let end = end.trim();

            let start_num = start
                .parse::<i64>()
                .map_err(|_| A1Error::InvalidTableRef("Invalid row number".into()))?;

            // Handle cases like "5:"
            if end.is_empty() {
                return Ok(Token::RowRange(start_num, UNBOUNDED));
            }

            // Handle "5:10"
            let end_num = end
                .parse::<i64>()
                .map_err(|_| A1Error::InvalidTableRef("Invalid row number".into()))?;

            return Ok(Token::RowRange(start_num, end_num));
        }

        Err(A1Error::InvalidTableRef("Invalid row specification".into()))
    }

    /// Separates bracketed entries, allowing double brackets and ' to escape
    /// special characters. Returns a list of Strings that can be tokenized.
    fn bracketed_entries(s: &str) -> Result<Vec<String>, A1Error> {
        let mut entries = Vec::new();

        // inside an escaped region
        let mut in_double_brackets = false;

        // special area is a bracketed region that starts with '#'
        let mut in_special = false;

        // track bracket count
        let mut bracket_count = 0;

        // track current entry
        let mut entry = String::new();

        let mut chars = s.chars();
        while let Some(c) = chars.next() {
            match c {
                '#' => {
                    if !in_double_brackets {
                        in_special = true;
                        entry.push(c);
                    }
                }
                ' ' => {
                    // ignore whitespace if between entries or in a special area
                    if !entry.is_empty() && !in_special {
                        entry.push(c);
                    }
                }
                '[' => {
                    if bracket_count == 1 {
                        in_double_brackets = true;
                    }
                    bracket_count += 1;
                    if bracket_count > 2 {
                        return Err(A1Error::InvalidTableRef("Unexpected [".into()));
                    }
                }
                ']' => {
                    bracket_count -= 1;
                    if bracket_count < 0 {
                        return Err(A1Error::InvalidTableRef("Unexpected ]".into()));
                    }
                    if bracket_count == 1 {
                        in_double_brackets = false;
                    }
                    in_special = false;
                }
                '\'' => {
                    if let Some(c) = chars.next() {
                        entry.push(c);
                    } else {
                        return Err(A1Error::InvalidTableRef(
                            "Unexpected escape character '".into(),
                        ));
                    }
                }
                ',' => {
                    if in_special || in_double_brackets {
                        entry.push(c);
                    } else {
                        if entry.is_empty() {
                            return Err(A1Error::InvalidTableRef("Empty entry found".into()));
                        }
                        entries.push(entry.trim().to_string());
                        entry = String::new();
                    }
                }
                ':' => {
                    if in_special || in_double_brackets {
                        entry.push(c);
                    } else if entry.is_empty() {
                        return Err(A1Error::InvalidTableRef("Empty entry found".into()));
                    } else {
                        entries.push(entry.trim().to_string());
                        entries.push(":".to_string());
                        entry = String::new();
                    }
                }
                c => {
                    entry.push(c);
                }
            }
        }
        if !entry.is_empty() {
            entries.push(entry);
        }

        Ok(entries)
    }

    pub(crate) fn tokenize(s: &str) -> Result<Vec<Token>, A1Error> {
        // if there are no brackets, then it's a column name
        if !s.contains('[') {
            return Ok(vec![Token::Column(s.to_string())]);
        }

        let bracketed_entries = Self::bracketed_entries(s)?;

        let mut tokens = Vec::new();
        let mut iter = bracketed_entries.iter().peekable();
        while let Some(entry) = iter.next() {
            match entry.as_str() {
                "#HEADERS" => tokens.push(Token::Headers),
                "#DATA" => tokens.push(Token::Data),
                "#TOTALS" => tokens.push(Token::Totals),
                "#ALL" => tokens.push(Token::All),
                ":" => return Err(A1Error::InvalidTableRef("Unexpected colon".into())),
                s => {
                    if s.is_empty() {
                        continue;
                    }
                    if let Some(s) = s.strip_prefix('#') {
                        tokens.push(Self::tokenize_rows(s)?);
                    } else if iter.peek().is_some_and(|s| **s == ":") {
                        // skip the colon
                        iter.next();
                        if let Some(column_name) = iter.next() {
                            tokens.push(Token::ColumnRange(s.to_string(), column_name.to_string()));
                        } else {
                            tokens.push(Token::ColumnToEnd(s.to_string()));
                        }
                    } else {
                        tokens.push(Token::Column(s.to_string()));
                    }
                }
            }
        }
        Ok(tokens)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_bracketed_entries() {
        assert_eq!(
            TableRef::bracketed_entries("[column 1]").unwrap(),
            vec!["column 1"]
        );
        assert_eq!(
            TableRef::bracketed_entries("[#data]").unwrap(),
            vec!["#data"]
        );
        assert_eq!(
            TableRef::bracketed_entries("[#12,15],[column 1],[column2]").unwrap(),
            vec!["#12,15", "column 1", "column2"]
        );
        assert_eq!(
            TableRef::bracketed_entries("[#12, 15], [column 1] , [column2]").unwrap(),
            vec!["#12,15", "column 1", "column2"]
        );
        assert_eq!(
            TableRef::bracketed_entries("[#ALL],[column 1]:[column2]").unwrap(),
            vec!["#ALL", "column 1", ":", "column2"]
        );
    }

    #[test]
    fn test_bracketed_entries_escaped_tick() {
        assert_eq!(
            TableRef::bracketed_entries(
                "[#ALL],[column 1', and column B]:[column2': the nice one]"
            )
            .unwrap(),
            vec![
                "#ALL",
                "column 1, and column B",
                ":",
                "column2: the nice one"
            ]
        );
    }

    #[test]
    fn test_bracketed_entries_escaped_brackets() {
        assert_eq!(
            TableRef::bracketed_entries(
                "[#ALL],[[column 1, and column B]]:[[column2: the nice one]]"
            )
            .unwrap(),
            vec![
                "#ALL",
                "column 1, and column B",
                ":",
                "column2: the nice one"
            ]
        );
    }

    #[test]
    fn test_tokenize_column_name() {
        assert_eq!(
            TableRef::tokenize("[Column 1]").unwrap(),
            vec![Token::Column("Column 1".to_string())]
        );
        assert_eq!(
            TableRef::tokenize("[[Column 1]]").unwrap(),
            vec![Token::Column("Column 1".to_string())]
        );
    }

    #[test]
    fn test_tokenize_special() {
        let special = [
            ("[#HEADERS]", Token::Headers),
            ("[#DATA]", Token::Data),
            ("[#TOTALS]", Token::Totals),
            ("[#ALL]", Token::All),
        ];
        for (s, expected) in special {
            assert_eq!(
                TableRef::tokenize(s).unwrap(),
                vec![expected.clone()],
                "Expected {:?} for {}",
                expected,
                s
            );
        }
    }

    #[test]
    fn test_tokenize_rows() {
        let rows = [
            ("1", Token::RowRange(1, 1)),
            ("1:10", Token::RowRange(1, 10)),
            ("1:", Token::RowRange(1, UNBOUNDED)),
            ("2:", Token::RowRange(2, UNBOUNDED)),
            ("LAST", Token::RowRange(UNBOUNDED, UNBOUNDED)),
            ("This Row", Token::ThisRow),
        ];
        for (s, expected) in rows {
            assert_eq!(
                TableRef::tokenize_rows(s)
                    .unwrap_or_else(|e| panic!("Failed to tokenize rows '{}': {}", s, e)),
                expected.clone(),
                "Expected {:?} for {}",
                expected,
                s
            );
        }
    }

    #[test]
    fn test_tokenize_columns() {
        let columns = [
            ("[Column 1]", vec![Token::Column("Column 1".to_string())]),
            (
                "[[Column,: 1]]",
                vec![Token::Column("Column,: 1".to_string())],
            ),
            (
                "[Column 1]:[Column 2]",
                vec![Token::ColumnRange(
                    "Column 1".to_string(),
                    "Column 2".to_string(),
                )],
            ),
            (
                "[Column 1]:",
                vec![Token::ColumnToEnd("Column 1".to_string())],
            ),
        ];
        for (s, expected) in columns {
            assert_eq!(
                TableRef::tokenize(s).unwrap(),
                expected.clone(),
                "Expected {:?} for {}",
                expected,
                s
            );
        }
    }

    #[test]
    fn test_tokenize_rows_columns() {
        let column_rows = [
            (
                "[#12],[Column 1]",
                vec![
                    Token::RowRange(12, 12),
                    Token::Column("Column 1".to_string()),
                ],
            ),
            (
                "[#12:15],[Column 1]:[Column 2]",
                vec![
                    Token::RowRange(12, 15),
                    Token::ColumnRange("Column 1".to_string(), "Column 2".to_string()),
                ],
            ),
            (
                "[#12:15],[Column 1]:",
                vec![
                    Token::RowRange(12, 15),
                    Token::ColumnToEnd("Column 1".to_string()),
                ],
            ),
        ];
        for (s, expected) in column_rows {
            assert_eq!(
                TableRef::tokenize(s).unwrap(),
                expected,
                "Expected {:?} for {}",
                expected,
                s
            );
        }
    }
}
