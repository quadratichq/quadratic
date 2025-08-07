use anyhow::{Result, bail};
use chrono::{NaiveDate, NaiveDateTime, NaiveTime};

use crate::{
    Pos,
    a1::A1Selection,
    controller::{operations::operation::Operation, transaction_types::JsCellValueResult},
    grid::{
        NumericFormat, NumericFormatKind, Sheet,
        formats::{FormatUpdate, SheetFormatUpdates},
    },
};

use super::{CellValue, number::decimal_from_str};

impl CellValue {
    // Converts a JS Date to a Date
    fn from_js_date(value: &String) -> CellValue {
        let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") else {
            return CellValue::Text(value.to_owned());
        };
        CellValue::Date(date)
    }

    // Converts a JS Date to either a Date or DateTime (depending if the time is
    // set to midnight). This is used by languages that don't return a different
    // response for Date and DateTime
    fn from_js_date_time(value: &str) -> CellValue {
        // need to strip timezone info
        let value = value.trim_end_matches('Z');
        let Ok(date) = NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f") else {
            return CellValue::Text(value.to_owned());
        };
        if date.time() == NaiveTime::default() {
            CellValue::Date(date.date())
        } else {
            CellValue::DateTime(date)
        }
    }

    /// Convert stringified values and types from JS to CellValue
    ///
    /// `value` is the stringified value
    /// `js_type` is the stringified CelLValue type
    pub fn from_js(
        cell_value: JsCellValueResult,
        pos: Pos,
        sheet: &mut Sheet,
    ) -> Result<(CellValue, Vec<Operation>)> {
        let mut ops = vec![];

        let JsCellValueResult(value, type_u8) = cell_value;

        let cell_value = match type_u8 {
            2 => {
                if let Some((currency, number)) = CellValue::unpack_currency(&value) {
                    let numeric_format = NumericFormat {
                        kind: NumericFormatKind::Currency,
                        symbol: Some(currency),
                    };
                    sheet
                        .formats
                        .numeric_format
                        .set(pos, Some(numeric_format.clone()));

                    ops.push(Operation::SetCellFormatsA1 {
                        sheet_id: sheet.id,
                        formats: SheetFormatUpdates::from_selection(
                            &A1Selection::from_single_cell(pos.to_sheet_pos(sheet.id)),
                            FormatUpdate {
                                numeric_format: Some(Some(numeric_format.clone())),
                                ..Default::default()
                            },
                        ),
                    });

                    // We no longer automatically set numeric decimals for
                    // currency; instead, we handle changes in currency decimal
                    // length by using 2 if currency is set by default.

                    CellValue::Number(number)
                } else if let Ok(number) = decimal_from_str(&value) {
                    CellValue::Number(number)
                } else if let Some(number) = CellValue::unpack_percentage(&value) {
                    let numeric_format = NumericFormat {
                        kind: NumericFormatKind::Percentage,
                        symbol: None,
                    };
                    sheet
                        .formats
                        .numeric_format
                        .set(pos, Some(numeric_format.clone()));

                    ops.push(Operation::SetCellFormatsA1 {
                        sheet_id: sheet.id,
                        formats: SheetFormatUpdates::from_selection(
                            &A1Selection::from_single_cell(pos.to_sheet_pos(sheet.id)),
                            FormatUpdate {
                                numeric_format: Some(Some(numeric_format.clone())),
                                ..Default::default()
                            },
                        ),
                    });

                    CellValue::Number(number)
                } else {
                    bail!("Could not parse number: {}", &value);
                }
            }
            1 => {
                if value.to_lowercase().starts_with("<html>")
                    || value.to_lowercase().starts_with("<div>")
                {
                    CellValue::Html(value)
                } else if let Some(time) = Self::unpack_time(&value) {
                    time
                } else {
                    CellValue::Text(value)
                }
            }
            3 => {
                let is_true = value.eq_ignore_ascii_case("true");
                CellValue::Logical(is_true)
            }
            11 => Self::from_js_date_time(&value),
            9 => Self::from_js_date(&value),
            4 => CellValue::unpack_duration(&value).unwrap_or(CellValue::Text(value)),
            8 => CellValue::Image(value),
            _ => CellValue::unpack_date_time(&value)
                .or_else(|| CellValue::unpack_duration(&value))
                .unwrap_or(CellValue::Text(value)),
        };

        Ok((cell_value, ops))
    }
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_image() {
        let value = CellValue::Image("test".into());
        assert_eq!(value.to_string(), "test");
        assert_eq!(value.type_name(), "image");

        let sheet = &mut Sheet::test();
        let value = CellValue::from_js(JsCellValueResult("test".into(), 8), (0, 1).into(), sheet);
        assert_eq!(value.unwrap().0, CellValue::Image("test".into()));
    }

    #[test]
    fn from_js_date() {
        let value = "2024-08-15T10:53:48.750Z".to_string();
        let js_type = 11;
        let pos = (0, 1).into();
        let sheet = &mut Sheet::test();
        let value = CellValue::from_js(JsCellValueResult(value.clone(), js_type), pos, sheet);
        assert_eq!(
            value.unwrap().0,
            CellValue::DateTime(
                NaiveDateTime::parse_from_str("2024-08-15T10:53:48.750", "%Y-%m-%dT%H:%M:%S%.f")
                    .unwrap()
            )
        );

        let value = "2021-09-01T00:00:00.000Z".to_string();
        let js_type = 11;
        let pos = (0, 1).into();
        let sheet = &mut Sheet::test();
        let value = CellValue::from_js(JsCellValueResult(value.clone(), js_type), pos, sheet);
        assert_eq!(
            value.unwrap().0,
            CellValue::Date(NaiveDate::parse_from_str("2021-09-01", "%Y-%m-%d").unwrap())
        );

        let value = "2021-09-01".to_string();
        let js_type = 9;
        let pos = (0, 1).into();
        let sheet = &mut Sheet::test();
        let value = CellValue::from_js(JsCellValueResult(value.clone(), js_type), pos, sheet);
        assert_eq!(
            value.unwrap().0,
            CellValue::Date(NaiveDate::parse_from_str("2021-09-01", "%Y-%m-%d").unwrap())
        );
    }
}
