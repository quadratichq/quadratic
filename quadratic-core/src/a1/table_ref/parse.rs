use lazy_static::lazy_static;
use regex::Regex;

use crate::a1::{A1Context, A1Error};

use super::{ColRange, TableRef, tokenize::Token};

lazy_static! {
    static ref TABLE_NAME_PATTERN: Regex = Regex::new(r"^([a-zA-Z0-9_.-]{1,255})(?:\[(.*)\])?$")
        .expect("Invalid TABLE_NAME_PATTERN regex");
}

impl TableRef {
    /// Parses the table name using a regex from the start of the string.
    /// Returns the table name and the remaining string.
    fn parse_table_name(s: &str) -> Result<(String, &str), A1Error> {
        if let Some(captures) = TABLE_NAME_PATTERN.captures(s)
            && let Some(name) = captures.get(1) {
                let remaining = captures.get(2).map_or("", |m| m.as_str()).trim();
                return Ok((name.as_str().to_string(), remaining));
            }
        Err(A1Error::InvalidTableRef("Invalid table name".into()))
    }

    /// Parse a table reference and returns a list of TableRefs. A list is
    /// required because we break non-rectangular regions into multiple
    /// TableRefs, For example: `Table1[[Column 1],[Column 3]]` will become
    /// `Table1[Column 1]` and `Table1[Column 3]`.
    pub fn parse(s: &str, a1_context: &A1Context) -> Result<TableRef, A1Error> {
        let (table_name, remaining) = Self::parse_table_name(s)?;
        let Some(table) = a1_context.try_table(&table_name) else {
            return Err(A1Error::TableNotFound(table_name.clone()));
        };

        // if it's just the table name, return the entire TableRef
        if remaining.trim().is_empty() {
            return Ok(Self {
                table_name: table.table_name.to_owned(),
                data: true,
                headers: false,
                totals: false,
                col_range: ColRange::All,
                this_row: false,
            });
        }

        let mut col_range = None;
        let mut data = None;
        let mut headers = false;
        let mut totals = false;
        let mut this_row = false;

        for token in Self::tokenize(remaining)? {
            match token {
                Token::Column(mut name) => {
                    if name.starts_with('@') {
                        this_row = true;
                        name = name[1..].to_string();
                    };
                    if col_range.is_some() {
                        return Err(A1Error::MultipleColumnDefinitions);
                    }
                    if let Some(index) = table.try_col_index(&name) {
                        col_range =
                            Some(ColRange::Col(table.visible_columns[index as usize].clone()));
                    } else {
                        return Err(A1Error::InvalidColumn(name.clone()));
                    }
                }
                Token::ColumnRange(mut start, end) => {
                    if start.starts_with('@') {
                        this_row = true;
                        start = start[1..].to_string();
                    };
                    if col_range.is_some() {
                        return Err(A1Error::MultipleColumnDefinitions);
                    }
                    let Some(start) = table.try_col_index(&start) else {
                        return Err(A1Error::InvalidColumn(start.clone()));
                    };
                    let Some(end) = table.try_col_index(&end) else {
                        return Err(A1Error::InvalidColumn(end.clone()));
                    };
                    col_range = Some(ColRange::ColRange(
                        table.visible_columns[start as usize].clone(),
                        table.visible_columns[end as usize].clone(),
                    ));
                }
                Token::ColumnToEnd(mut name) => {
                    if name.starts_with('@') {
                        this_row = true;
                        name = name[1..].to_string();
                    };
                    if col_range.is_some() {
                        return Err(A1Error::MultipleColumnDefinitions);
                    }
                    if let Some(index) = table.try_col_index(&name) {
                        col_range = Some(ColRange::ColToEnd(
                            table.visible_columns[index as usize].clone(),
                        ));
                    } else {
                        return Err(A1Error::InvalidColumn(name.clone()));
                    }
                }
                Token::All => {
                    headers = true;
                    data = Some(true);
                    totals = true;
                }
                Token::Headers => {
                    if data.is_none() {
                        data = Some(false);
                    }
                    headers = true;
                }
                Token::Totals => {
                    if data.is_none() {
                        data = Some(false);
                    }
                    totals = true;
                }
                Token::Data => {
                    data = Some(true);
                }
                Token::ThisRow => {
                    this_row = true;
                }
            }
        }

        Ok(TableRef {
            table_name: table.table_name.to_owned(),
            data: if this_row {
                false
            } else {
                data.unwrap_or(true)
            },
            headers,
            totals,
            col_range: col_range.unwrap_or(ColRange::All),
            this_row,
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_parse_table_name() {
        let (table_name, remaining) = TableRef::parse_table_name("Table1[Column 1]").unwrap();
        assert_eq!(table_name, "Table1");
        assert_eq!(remaining, "Column 1");
    }

    #[test]
    fn test_simple_table_ref() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        let table_ref = TableRef::parse("Table1", &context).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert!(table_ref.data);
        assert!(!table_ref.headers);
        assert_eq!(table_ref.col_range, ColRange::All);
    }

    #[test]
    fn test_table_name_case_insensitive() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        println!("context: {context:?}");
        let table_ref = TableRef::parse("table1", &context).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
    }

    #[test]
    fn test_table_name_not_found() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        let result = TableRef::parse("Table2", &context);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            A1Error::TableNotFound("Table2".to_string())
        );
    }

    #[test]
    fn test_table_with_column() {
        let context = A1Context::test(
            &[],
            &[("Table1", &["Column 1", "Column 2"], Rect::test_a1("A1:B2"))],
        );
        let table_ref = TableRef::parse("Table1[Column 1]", &context).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert_eq!(table_ref.col_range, ColRange::Col("Column 1".to_string()));
    }

    #[test]
    fn test_table_with_headers() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        let table_ref = TableRef::parse("Table1[[#HEADERS]]", &context).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert!(table_ref.headers);
    }

    #[test]
    fn test_table_parameters() {
        let context = A1Context::test(
            &[],
            &[(
                "Table1",
                &["Column 1", "Column 2", "Column 3", "Column 4"],
                Rect::test_a1("A1:B2"),
            )],
        );
        let table_ref = TableRef::parse("Table1[[#DATA],[#HEADERS],[Column 1]]", &context).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert!(table_ref.data);
        assert!(table_ref.headers);
        assert_eq!(table_ref.col_range, ColRange::Col("Column 1".to_string()));
    }

    #[test]
    fn test_table_parameters_all() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        let table_ref = TableRef::parse("Table1[#ALL]", &context).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert!(table_ref.data);
        assert!(table_ref.headers);
        assert!(table_ref.totals);
        assert_eq!(table_ref.col_range, ColRange::All);
    }

    #[test]
    fn test_table_parameters_headers() {
        let cases = [
            "Table1[[#HEADERS]]",
            "Table1[#HEADERS]",
            "Table1[#headers]",
            "Table1[[#Headers]]",
        ];
        for case in cases {
            let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
            let table_ref = TableRef::parse(case, &context).unwrap();
            assert_eq!(table_ref.table_name, "Table1");
            assert!(!table_ref.data);
            assert!(table_ref.headers);
            assert!(!table_ref.totals);
            assert_eq!(table_ref.col_range, ColRange::All);
        }
    }

    #[test]
    fn test_table_parameters_this_row() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        let table_ref = TableRef::parse("Table1[[#THIS ROW],[A]]", &context).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert_eq!(table_ref.col_range, ColRange::Col("A".to_string()));
        assert!(table_ref.this_row);
        assert!(!table_ref.data);
        assert!(!table_ref.headers);
        assert!(!table_ref.totals);
    }

    #[test]
    fn test_table_parameters_this_row_symbol() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        let table_ref = TableRef::parse("Table1[@A]", &context).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert_eq!(table_ref.col_range, ColRange::Col("A".to_string()));
        assert!(table_ref.this_row);
        assert!(!table_ref.data);
        assert!(!table_ref.headers);
        assert!(!table_ref.totals);
    }

    #[test]
    fn test_table_parameters_this_row_symbol_double_bracket() {
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        let table_ref = TableRef::parse("Table1[[@A]]", &context).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert_eq!(table_ref.col_range, ColRange::Col("A".to_string()));
        assert!(table_ref.this_row);
        assert!(!table_ref.data);
        assert!(!table_ref.headers);
        assert!(!table_ref.totals);
    }
}
