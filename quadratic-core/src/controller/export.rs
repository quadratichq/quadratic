use std::collections::HashMap;

use anyhow::{Context, Result, anyhow, bail};
use csv::Writer;
use itertools::PeekingNext;
use lazy_static::lazy_static;
use rust_decimal::{Decimal, prelude::ToPrimitive};
use rust_xlsxwriter::{
    Format, FormatAlign, FormatPattern, FormatUnderline, Workbook, XlsxError, worksheet::Worksheet,
};

use super::GridController;
use crate::{
    CellValue, Pos, Value,
    a1::{A1Selection, CellRefRange},
    date_time::{DEFAULT_DATE_FORMAT, DEFAULT_DATE_TIME_FORMAT, DEFAULT_TIME_FORMAT},
    grid::{CellAlign, CellVerticalAlign, CodeCellLanguage, GridBounds, NumericFormatKind, Sheet},
};

lazy_static! {
    static ref CHRONO_TO_EXCEL_MAPPING: HashMap<&'static str, &'static str> = {
        let mut mapping = HashMap::new();

        mapping.insert("%Y", "yyyy"); // Full year (e.g., 2025)
        mapping.insert("%y", "yy"); // Two-digit year (e.g., 25)
        mapping.insert("%m", "mm"); // Month number (01-12)
        mapping.insert("%b", "mmm"); // Abbreviated month name (e.g., Jul)
        mapping.insert("%h", "mmm"); // Alternative abbreviated month name
        mapping.insert("%B", "mmmm"); // Full month name (e.g., July)
        mapping.insert("%d", "dd"); // Day of the month (01-31)
        mapping.insert("%e", "d"); // Day of the month (1-31), space-padded
        mapping.insert("%H", "hh"); // Hour (00-23)
        mapping.insert("%I", "hh"); // Hour (01-12) - Note: Excel doesn't distinguish, needs AM/PM
        mapping.insert("%M", "mm"); // Minute (00-59)
        mapping.insert("%S", "ss"); // Second (00-59)
        mapping.insert("%F", "yyyy-mm-dd"); // ISO 8601 date format
        mapping.insert("%T", "hh:mm:ss"); // 24-hour time format
        mapping.insert("%p", "AM/PM"); // AM/PM indicator
        mapping.insert("%P", "am/pm"); // am/pm indicator (lowercase)

        mapping
    };
}

impl GridController {
    /// exports a CSV string from a selection on the grid.
    ///
    /// Returns a [`String`].
    pub fn export_csv_selection(&self, selection: &mut A1Selection) -> Result<String> {
        let sheet = self
            .grid
            .try_sheet(selection.sheet_id)
            .context("Sheet not found")?;

        if let Some(CellRefRange::Table { range }) = selection.ranges.first_mut() {
            range.headers = true;
        }

        let bounds = sheet
            .selection_bounds(selection, false, false, true, &self.a1_context)
            .context("No values")?;

        let values = sheet.selection_sorted_vec(selection, false, true, &self.a1_context);
        let mut writer = Writer::from_writer(vec![]);
        let mut iter = values.iter();
        let context = self.a1_context();
        for y in bounds.min.y..=bounds.max.y {
            let mut line = vec![];
            for x in bounds.min.x..=bounds.max.x {
                // we need to ignore unselected columns or rows
                if selection.might_contain_pos(Pos { x, y }, context) {
                    if let Some((_, value)) = iter.peeking_next(|(pos, _)| pos.x == x && pos.y == y)
                    {
                        line.push(value.to_string());
                    } else {
                        line.push("".to_string());
                    }
                }
            }

            if !line.is_empty() {
                writer.write_record(line)?;
            }
        }
        let output = String::from_utf8(writer.into_inner()?)?;

        Ok(output)
    }

    /// Exports an excel file from the grid.
    /// Only preserves formulas, everything else is flattened.
    ///
    /// Returns a [`Vec<u8>`].
    pub fn export_excel(&self) -> Result<Vec<u8>> {
        let mut workbook = Workbook::new();
        let error = |e: XlsxError| anyhow!("Error exporting excel file: {}", e);

        for sheet in self.sheets() {
            // add the sheet to the workbook and set the name
            let worksheet = workbook.add_worksheet();
            worksheet
                .set_name(sheet.name.to_string())
                .map_err(|e| anyhow!("Error creating excel sheet: {}", e))?;

            // column widths
            let custom_column_widths: Vec<(i64, f64)> =
                sheet.offsets.custom_column_widths().collect();

            for (col, width) in custom_column_widths {
                let excel_col = (col - 1) as u16;
                // convert from pixels to Excel column width units
                let excel_width = width / 7.0;

                worksheet
                    .set_column_width(excel_col, excel_width)
                    .map_err(error)?;
            }

            // row heights
            let custom_row_heights: Vec<(i64, f64)> = sheet.offsets.custom_row_heights().collect();

            for (row, height) in custom_row_heights {
                let excel_row = (row - 1) as u32;
                // convert from pixels to Excel row height units
                let excel_height = height / 1.5;

                worksheet
                    .set_row_height(excel_row, excel_height)
                    .map_err(error)?;
            }

            // add grid values to the worksheet
            match sheet.bounds(true) {
                GridBounds::Empty => continue,
                GridBounds::NonEmpty(rect) => {
                    for pos in rect.iter() {
                        let (row, col) = (pos.y as u32 - 1, pos.x as u16 - 1);
                        let mut is_formula_output = false;

                        // data table output
                        if let Some((_pos, data_table)) = sheet.data_tables.get_contains(pos) {
                            if let Some(CellValue::Code(code_cell_value)) = sheet.cell_value(pos) {
                                let is_formula =
                                    code_cell_value.language == CodeCellLanguage::Formula;
                                is_formula_output =
                                    data_table.get_language() == CodeCellLanguage::Formula;

                                // we currently only care about formualas
                                if is_formula {
                                    let code = code_cell_value.code.as_str();
                                    let display_value = data_table.display_value(false)?;

                                    match display_value {
                                        Value::Single(value) => {
                                            worksheet
                                                .write_formula(row, col, code)
                                                .map_err(error)?
                                                .set_formula_result(row, col, value.to_string());
                                        }
                                        Value::Array(array) => {
                                            let size = array.size();
                                            let last_row = row + size.h.get() - 1;
                                            let last_col = col + size.w.get() as u16 - 1;

                                            worksheet
                                                .write_array_formula(
                                                    row, col, last_row, last_col, code,
                                                )
                                                .map_err(error)?;
                                        }
                                        // we don't expect tuples
                                        _ => bail!("Unexpected value type"),
                                    }
                                }
                            }
                        }

                        // flatten all non-formula data
                        if !is_formula_output {
                            write_excel_value(worksheet, pos, col, row, sheet)?;
                        }
                    }
                }
            }
        }

        let buffer = workbook
            .save_to_buffer()
            .map_err(|e| anyhow!("Error writing excel file: {}", e))?;

        Ok(buffer)
    }
}

/// Writes a value to an excel worksheet and sets the format.
fn write_excel_value(
    worksheet: &mut Worksheet,
    pos: Pos,
    col: u16,
    row: u32,
    sheet: &Sheet,
) -> Result<()> {
    if let Some(v) = sheet.display_value(pos) {
        let (cell_value, format) = get_excel_formats(v, pos, sheet);

        let result = match &cell_value {
            CellValue::Number(n) => worksheet.write_number(row, col, n.to_f64().unwrap_or(0.0)),
            CellValue::Text(s) => worksheet.write_string(row, col, s),
            CellValue::Date(d) => worksheet.write_datetime(row, col, d),
            CellValue::Time(t) => worksheet.write_datetime(row, col, t),
            CellValue::DateTime(dt) => worksheet.write_datetime(row, col, dt),
            CellValue::Logical(b) => worksheet.write_boolean(row, col, *b),
            _ => worksheet.write_string(row, col, cell_value.to_string()),
        }
        .map(|_| ())
        .map_err(|e| anyhow!("Error writing excel value: {}", e));

        worksheet.set_cell_format(row, col, &format)?;

        return result;
    }

    Ok(())
}

/// Gets the excel formats for a cell value.
fn get_excel_formats(mut v: CellValue, pos: Pos, sheet: &Sheet) -> (CellValue, Format) {
    let mut format = Format::new();
    let formats = sheet.formats.to_owned();
    let bold = formats.bold.get(pos).unwrap_or(false);
    let italic = formats.italic.get(pos).unwrap_or(false);
    let underline = formats.underline.get(pos).unwrap_or(false);
    let strike_through = formats.strike_through.get(pos).unwrap_or(false);
    let date_time_format = formats.date_time.get(pos);

    if bold {
        format = format.set_bold();
    }

    if italic {
        format = format.set_italic();
    }

    if underline {
        format = format.set_underline(FormatUnderline::Single);
    }

    if strike_through {
        format = format.set_font_strikethrough();
    }

    if let Some(text_color) = formats.text_color.get(pos) {
        format = format.set_font_color(text_color.as_str());
    }

    if let Some(fill_color) = formats.fill_color.get(pos) {
        format = format.set_pattern(FormatPattern::Solid);
        format = format.set_background_color(fill_color.as_str());
    }

    if let Some(align) = formats.align.get(pos) {
        let align = match align {
            CellAlign::Left => FormatAlign::Left,
            CellAlign::Center => FormatAlign::Center,
            CellAlign::Right => FormatAlign::Right,
        };
        format = format.set_align(align);
    }

    if let Some(vertical_align) = formats.vertical_align.get(pos) {
        let align = match vertical_align {
            CellVerticalAlign::Top => FormatAlign::Top,
            CellVerticalAlign::Middle => FormatAlign::VerticalCenter,
            CellVerticalAlign::Bottom => FormatAlign::Bottom,
        };
        format = format.set_align(align);
    }

    if formats.wrap.get(pos).is_some() {
        format = format.set_text_wrap();
    }

    let mut num_format = String::new();

    if let Some(numeric_format) = formats.numeric_format.get(pos) {
        match numeric_format.kind {
            NumericFormatKind::Percentage => {
                if let CellValue::Number(n) = &mut v {
                    *n = n
                        .checked_div(Decimal::try_from(100.0_f64).unwrap_or(Decimal::ZERO))
                        .unwrap_or(Decimal::ZERO);
                }
                num_format = "0.0%".to_string();
            }
            NumericFormatKind::Currency => num_format = "$0.00".to_string(),
            NumericFormatKind::Number => {}
            NumericFormatKind::Exponential => num_format = "0.00E+00".to_string(),
        }
    }

    // this needs to be before the numeric decimals
    if let Some(numeric_commas) = formats.numeric_commas.get(pos) {
        if numeric_commas {
            num_format = "#,##0".to_string();
        }
    }

    if let Some(numeric_decimals) = formats.numeric_decimals.get(pos) {
        num_format = format!("{num_format}.{}", "0".repeat(numeric_decimals as usize));
    }

    if !num_format.is_empty() {
        format = format.set_num_format(num_format);
    } else if let Some(date_time_format) = date_time_format {
        format = format.set_num_format(chrono_to_excel_format(&date_time_format));
    } else {
        // we need to use default date time format for dates, times, and date times
        // where the format isn't explicitly set
        match v {
            CellValue::Date(_) => {
                format = format.set_num_format(chrono_to_excel_format(DEFAULT_DATE_FORMAT));
            }
            CellValue::Time(_) => {
                format = format.set_num_format(chrono_to_excel_format(DEFAULT_TIME_FORMAT));
            }
            CellValue::DateTime(_) => {
                format = format.set_num_format(chrono_to_excel_format(DEFAULT_DATE_TIME_FORMAT));
            }
            _ => {}
        }
    }

    (v, format)
}

/// Converts a chrono format to an excel format.
pub fn chrono_to_excel_format(chrono_format: &str) -> String {
    let mut result = String::new();
    let mut chars = chrono_format.chars().peekable();
    let mapping = &*CHRONO_TO_EXCEL_MAPPING;

    while let Some(ch) = chars.next() {
        if ch == '%' {
            if let Some(&next_ch) = chars.peek() {
                let specifier = format!("%{next_ch}");

                if let Some(&excel_code) = mapping.get(specifier.as_str()) {
                    result.push_str(excel_code);
                    chars.next(); // consume the next character
                } else {
                    // unknown specifier, keep as-is
                    result.push(ch);
                }
            } else {
                // '%' at end of string, keep as-is
                result.push(ch);
            }
        } else {
            // regular character, keep as-is
            result.push(ch);
        }
    }

    result
}

#[cfg(test)]
mod tests {

    use super::*;

    use crate::{
        Array,
        controller::{
            execution::execute_operation::execute_data_table::tests::assert_flattened_simple_csv,
            user_actions::import::tests::simple_csv,
        },
    };

    #[test]
    fn exports_a_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let mut selected = A1Selection::test_a1("A1:D4");
        let vals = vec![
            vec!["1", "2", "3", "4"],
            vec!["5", "6", "7", "8"],
            vec!["9", "10", "11", "12"],
            vec!["13", "14", "15", "16"],
        ];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_values(crate::Rect::new(1, 1, 4, 4), Array::from(vals));

        let result = gc.export_csv_selection(&mut selected).unwrap();
        let expected = "1,2,3,4\n5,6,7,8\n9,10,11,12\n13,14,15,16\n";

        assert_eq!(&result, expected);
    }

    #[test]
    fn exports_a_csv_with_a_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&pos, |dt| {
                dt.apply_first_row_as_header();
                Ok(())
            })
            .unwrap();
        let mut selected = A1Selection::test_a1("A1:D13");
        let result = gc.export_csv_selection(&mut selected).unwrap();
        println!("{result}");
    }

    #[test]
    fn exports_excel() {
        let (gc, ..) = simple_csv();
        let file_name = "test.xlsx";
        let excel = gc.export_excel();

        assert!(excel.is_ok());

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        // avoid collision with the default sheet
        gc.grid.update_sheet_name(sheet_id, "ignore").unwrap();

        gc.import_excel(&excel.unwrap(), file_name, None).unwrap();
        let sheet_id = gc.sheet_ids()[1];
        let pos = Pos { x: 1, y: 1 };

        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        // TODO(ddimaria): test excel file formatting once import formatting is implemented
    }

    #[test]
    fn test_write_excel_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let pos = Pos { x: 1, y: 1 };
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        write_excel_value(worksheet, pos, 0, 0, sheet).unwrap();
        let buffer = workbook.save_to_buffer();

        assert!(buffer.is_ok());
    }

    #[test]
    fn test_get_excel_formats() {
        let cell_value = CellValue::Number(100.into());
        let pos = Pos { x: 1, y: 1 };
        let sheet = Sheet::test();
        let (v, _format) = get_excel_formats(cell_value.clone(), pos, &sheet);
        assert_eq!(v, cell_value);

        // TODO(ddimaria): no getters exposed for the Format struct from xlsxwriter
        // so we can't test the format. I may back contribute to the repo to open up
        // the `has_*` members.
    }

    #[test]
    fn test_converts_chrono_format_to_excel_format() {
        let result = chrono_to_excel_format("%Y-%m-%d");
        assert_eq!(result, "yyyy-mm-dd");

        let result = chrono_to_excel_format("%Y-%m-%d %H:%M:%S");
        assert_eq!(result, "yyyy-mm-dd hh:mm:ss");
    }
}
