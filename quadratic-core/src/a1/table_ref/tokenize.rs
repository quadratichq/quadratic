//! Tokenizes a table reference after the table_name has been removed.

use super::*;

#[derive(Debug, PartialEq, Clone)]
pub(crate) enum Token {
    All,
    Headers,
    Data,
    Totals,
    Column(String),
    ColumnRange(String, String),
    ColumnToEnd(String),
}

impl TableRef {
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
        // todo: might be an edge case where the column name includes '#
        if !s.contains('[') && !s.starts_with('#') {
            return Ok(vec![Token::Column(s.to_string())]);
        }

        let bracketed_entries = Self::bracketed_entries(s)?;

        let mut tokens = Vec::new();
        let mut iter = bracketed_entries.iter().peekable();
        while let Some(entry) = iter.next() {
            match entry.to_uppercase().as_str() {
                "#HEADERS" => tokens.push(Token::Headers),
                "#DATA" => tokens.push(Token::Data),
                "#TOTALS" => tokens.push(Token::Totals),
                "#ALL" => tokens.push(Token::All),
                ":" => return Err(A1Error::InvalidTableRef("Unexpected colon".into())),
                _ => {
                    let s = entry.as_str();
                    if s.is_empty() {
                        continue;
                    }
                    if s.strip_prefix('#').is_some() {
                        return Err(A1Error::InvalidTableRef("Unexpected #".into()));
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
                "Expected {expected:?} for {s}"
            );
            assert_eq!(
                TableRef::tokenize(s.to_lowercase().as_str()).unwrap(),
                vec![expected.clone()],
                "Expected {expected:?} for {s}"
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
                "Expected {expected:?} for {s}"
            );
        }
    }
}
