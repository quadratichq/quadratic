use lazy_static::lazy_static;
use regex::Regex;

use super::{tokenize::Token, ColRange, RowRange, RowRangeEntry, TableRef};
use crate::A1Error;

lazy_static! {
    static ref TABLE_NAME_PATTERN: Regex =
        Regex::new(r"^([a-zA-Z0-9_]{1,255})(?:\[(.*)\])?$").unwrap();
}

impl TableRef {
    /// Parses the table name using a regex from the start of the string.
    /// Returns the table name and the remaining string.
    fn parse_table_name(s: &str) -> Result<(String, &str), A1Error> {
        if let Some(captures) = TABLE_NAME_PATTERN.captures(s) {
            if let Some(name) = captures.get(1) {
                let remaining = captures.get(2).map_or("", |m| m.as_str()).trim();
                return Ok((name.as_str().to_string(), remaining));
            }
        }
        Err(A1Error::InvalidTableRef("Invalid table name".into()))
    }

    /// Parse a table reference given a list of table_names.
    pub fn parse(s: &str, table_names: &[String]) -> Result<Self, A1Error> {
        let (table_name, remaining) = Self::parse_table_name(s)?;
        let table_name = if let Some(name) = table_names
            .iter()
            .find(|t| t.eq_ignore_ascii_case(&table_name))
        {
            name.clone()
        } else {
            return Err(A1Error::TableNotFound(table_name.clone()));
        };

        // if it's just the table name, return the entire table TableRef
        if remaining.trim().is_empty() {
            return Ok(Self {
                table_name,
                data: true,
                headers: false,
                totals: false,
                row_ranges: RowRange::All,
                col_ranges: vec![],
            });
        }

        let mut row_ranges = None;
        let mut column_ranges = vec![];
        let mut data = None;
        let mut headers = false;
        let mut totals = false;

        for token in Self::tokenize(remaining)? {
            match token {
                Token::RowRange(start, end) => match row_ranges {
                    Some(RowRange::Rows(mut rows)) => {
                        rows.push(RowRangeEntry::new_rel(start as i64, end as i64));
                        row_ranges = Some(RowRange::Rows(rows));
                    }
                    Some(_) => {
                        return Err(A1Error::MultipleRowDefinitions);
                    }
                    None => {
                        row_ranges = Some(RowRange::Rows(vec![RowRangeEntry::new_rel(
                            start as i64,
                            end as i64,
                        )]));
                    }
                },
                Token::Column(name) => {
                    column_ranges.push(ColRange::Col(name));
                }
                Token::ColumnRange(start, end) => {
                    column_ranges.push(ColRange::ColRange(start, end));
                }
                Token::ColumnToEnd(name) => {
                    column_ranges.push(ColRange::ColumnToEnd(name));
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
                    if row_ranges.is_some() {
                        return Err(A1Error::MultipleRowDefinitions);
                    }
                    row_ranges = Some(RowRange::CurrentRow);
                }
            }
        }

        Ok(Self {
            table_name,
            data: data.unwrap_or(true),
            headers,
            totals,
            row_ranges: row_ranges.unwrap_or(RowRange::All),
            col_ranges: column_ranges,
        })
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_parse_table_name() {
        let (table_name, remaining) = TableRef::parse_table_name("Table1[Column 1]").unwrap();
        assert_eq!(table_name, "Table1");
        assert_eq!(remaining, "Column 1");
    }

    #[test]
    fn test_simple_table_ref() {
        let names = vec!["Table1".to_string()];
        let table_ref = TableRef::parse("Table1", &names).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert!(table_ref.data);
        assert!(!table_ref.headers);
        assert!(table_ref.col_ranges.is_empty());
    }

    #[test]
    fn test_table_name_case_insensitive() {
        let names = vec!["Table1".to_string()];
        let table_ref = TableRef::parse("table1", &names).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
    }

    #[test]
    fn test_table_name_not_found() {
        let names = vec!["Table1".to_string()];
        let result = TableRef::parse("Table2", &names);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            A1Error::TableNotFound("Table2".to_string())
        );
    }

    #[test]
    fn test_table_with_column() {
        let names = vec!["Table1".to_string()];
        let table_ref = TableRef::parse("Table1[Column Name]", &names).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert_eq!(table_ref.col_ranges.len(), 1);
        assert_eq!(
            table_ref.col_ranges[0],
            ColRange::Col("Column Name".to_string())
        );
    }

    #[test]
    fn test_table_with_headers() {
        let names = vec!["Table1".to_string()];
        let table_ref = TableRef::parse("Table1[[#HEADERS]]", &names).unwrap();
        assert_eq!(table_ref.table_name, "Table1");
        assert!(table_ref.headers);
    }

    #[test]
    fn test_table_with_row_range() {
        let names = vec![
            "Table1".to_string(),
            "Table2".to_string(),
            "Table3".to_string(),
        ];

        let variations = [
            (
                "Table1[[#12:15],[Column 1]]",
                TableRef {
                    table_name: "Table1".to_string(),
                    data: true,
                    headers: false,
                    totals: false,
                    row_ranges: RowRange::Rows(vec![RowRangeEntry::new_rel(12, 15)]),
                    col_ranges: vec![ColRange::Col("Column 1".to_string())],
                },
            ),
            (
                "TABLE2[ [#12:15], [Column 2]]",
                TableRef {
                    table_name: "Table2".to_string(),
                    data: true,
                    headers: false,
                    totals: false,
                    row_ranges: RowRange::Rows(vec![RowRangeEntry::new_rel(12, 15)]),
                    col_ranges: vec![ColRange::Col("Column 2".to_string())],
                },
            ),
            (
                "table3[[#12:15],[Column 3]]",
                TableRef {
                    table_name: "Table3".to_string(),
                    data: true,
                    headers: false,
                    totals: false,
                    row_ranges: RowRange::Rows(vec![RowRangeEntry::new_rel(12, 15)]),
                    col_ranges: vec![ColRange::Col("Column 3".to_string())],
                },
            ),
        ];

        for (s, expected) in variations.iter() {
            let table_ref = TableRef::parse(s, &names).unwrap();
            assert_eq!(table_ref, *expected, "{}", s);
        }
    }
}
