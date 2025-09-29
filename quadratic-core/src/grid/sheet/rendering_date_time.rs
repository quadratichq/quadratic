//! Handles converting Date, Time, and DateTime values to strings using strftime
//! format strings. This is a bit complicated because we have to handle the case
//! where the format string contains both date and time elements, but the value
//! is only a Date or Time. In this case, we need to truncate the format string
//! to only include the relevant elements. (Otherwise it throws an error.)

use crate::{
    CellValue,
    date_time::{date_time_to_date_time_string, date_to_date_string, time_to_time_string},
};

use super::Sheet;

impl Sheet {
    /// Format a Date, Time, or DateTime using a strftime-style format string.
    ///
    /// Note: we cannot include any time elements within a Date, or date elements
    /// within a Time. To remove this formatting, we parse the format string and
    /// truncate (we assume date is first and time is second; although this can
    /// be changed to be arbitrary if necessary down the road).
    pub(crate) fn value_date_time(value: &CellValue, date_time: Option<String>) -> String {
        match value {
            CellValue::DateTime(dt) => date_time_to_date_time_string(*dt, date_time),
            CellValue::Date(d) => date_to_date_string(*d, date_time),
            CellValue::Time(t) => time_to_time_string(*t, date_time),
            _ => value.to_display(),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use chrono::{NaiveDateTime, NaiveTime};

    use crate::{
        Rect,
        controller::GridController,
        grid::{CellAlign, js_types::JsRenderCell},
    };

    use super::*;

    #[test]
    fn value_date_time() {
        let date_time = "%Y-%m-%d %H:%M:%S".to_string();
        let value = CellValue::DateTime(
            NaiveDateTime::parse_from_str("2014-5-17T12:34:56+09:30", "%Y-%m-%dT%H:%M:%S%z")
                .unwrap(),
        );
        assert_eq!(
            Sheet::value_date_time(&value, Some(date_time.clone())),
            "2014-05-17 12:34:56"
        );

        let value = CellValue::Date(
            NaiveDateTime::parse_from_str("2014-5-17T12:34:56+09:30", "%Y-%m-%dT%H:%M:%S%z")
                .unwrap()
                .date(),
        );
        assert_eq!(
            Sheet::value_date_time(&value, Some(date_time.clone())),
            "2014-05-17"
        );

        let value = CellValue::Time(
            NaiveDateTime::parse_from_str("2014-5-17T12:34:56+09:30", "%Y-%m-%dT%H:%M:%S%z")
                .unwrap()
                .time(),
        );
        assert_eq!(
            Sheet::value_date_time(&value, Some(date_time.clone())),
            "12:34:56"
        );
    }

    #[test]
    fn render_cell_date_time() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let pos = pos![A1];
        let date_time = "%Y-%m-%d %H:%M:%S".to_string();
        let value = CellValue::DateTime(
            NaiveDateTime::parse_from_str("2014-5-17T12:34:56+09:30", "%Y-%m-%dT%H:%M:%S%z")
                .unwrap(),
        );
        gc.sheet_mut(sheet_id).set_value(pos, value);
        let sheet = gc.sheet(sheet_id);
        let rendering = sheet.get_render_cells(Rect::from_numbers(1, 1, 1, 1), gc.a1_context());
        assert_eq!(rendering.len(), 1);
        assert_eq!(
            rendering[0],
            JsRenderCell {
                x: 1,
                y: 1,
                align: Some(CellAlign::Right),
                value: "05/17/2014 12:34 PM".to_string(),
                ..Default::default()
            }
        );
        gc.sheet_mut(sheet_id)
            .formats
            .date_time
            .set_rect(1, 1, Some(1), None, Some(date_time));
        let rendering = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::from_numbers(1, 1, 1, 1), gc.a1_context());
        assert_eq!(rendering.len(), 1);
        assert_eq!(
            rendering[0],
            JsRenderCell {
                x: 1,
                y: 1,
                align: Some(CellAlign::Right),
                value: "2014-05-17 12:34:56".to_string(),
                ..Default::default()
            }
        );

        gc.sheet_mut(sheet_id).formats.date_time.set_rect(
            1,
            1,
            Some(1),
            None,
            Some("%Y-%m-%d".to_string()),
        );
        let rendering = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::from_numbers(1, 1, 1, 1), gc.a1_context());
        assert_eq!(rendering.len(), 1);
        assert_eq!(
            rendering[0],
            JsRenderCell {
                x: 1,
                y: 1,
                align: Some(CellAlign::Right),
                value: "2014-05-17".to_string(),
                ..Default::default()
            }
        );
    }

    #[test]
    fn cell_date_time_error() {
        let format = "%Y-%m-%d %I:%M:%S %p".to_string();
        let value = CellValue::Time(NaiveTime::from_str("17:12:00").unwrap());
        assert_eq!(Sheet::value_date_time(&value, Some(format)), "05:12:00 PM");
    }
}
