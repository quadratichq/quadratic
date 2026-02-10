use std::{io::Cursor, path::Path};

use anyhow::{Result, anyhow, bail};
use chrono::{NaiveDate, NaiveTime};
use regex::Regex;
use rust_decimal::prelude::ToPrimitive;

use crate::a1::A1Selection;
use crate::color::Rgba;
use crate::constants::FONT_SIZE_DISPLAY_ADJUSTMENT;
use crate::grid::sheet::borders::{BorderStyleCell, BorderStyleTimestamp, CellBorderLine};
use crate::grid::{CodeRun, DataTableKind};
use crate::{
    Array, CellValue, Pos, SheetPos,
    cell_values::CellValues,
    cellvalue::Import,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        execution::TransactionSource,
    },
    date_time::{DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT},
    grid::{
        CellAlign, CellVerticalAlign, CellWrap, CodeCellLanguage, DataTable, NumericFormat,
        NumericFormatKind, Sheet, SheetId, fix_names::sanitize_table_name,
        formats::SheetFormatUpdates, unique_data_table_name,
    },
    parquet::parquet_to_array,
    small_timestamp::SmallTimestamp,
};
use crate::{SheetRect, Value};
use calamine::{
    Data as ExcelData, Error as CalamineError, HorizontalAlignment, NumberFormat,
    Reader as ExcelReader, Sheets, VerticalAlignment, open_workbook_from_rs,
};

use super::{
    csv::{clean_csv_file, find_csv_info},
    operation::Operation,
};

const IMPORT_LINES_PER_OPERATION: u32 = 10000;
pub const COLUMN_WIDTH_MULTIPLIER: f64 = 7.0;
pub const ROW_HEIGHT_MULTIPLIER: f64 = 1.5;
pub const DEFAULT_FONT_SIZE: f64 = 11.0;

/// Pre-compiled regex pattern and escaped replacement for a named range.
/// This avoids recompiling the regex for every formula.
struct NamedRangeReplacement {
    name: String,
    pattern: Regex,
    replacement: String, // pre-escaped with $$ for $ characters
}

/// Replaces named range references in a formula with their full sheet references.
/// Uses word boundaries to avoid replacing partial matches (e.g., "A" in "ABC").
///
/// Note: This may incorrectly replace named ranges that appear inside string literals
/// (e.g., `="Hello Total World"` with named range `Total` would become
/// `="Hello Sheet1!$C$3 World"`). This is a known limitation; a string-aware parser
/// would be needed to handle this edge case.
fn replace_named_ranges(code: &str, named_ranges: &[NamedRangeReplacement]) -> String {
    let mut result = code.to_string();
    for named_range in named_ranges {
        if result.contains(named_range.name.as_str()) {
            result = named_range
                .pattern
                .replace_all(&result, named_range.replacement.as_str())
                .to_string();
        }
    }
    result
}

impl GridController {
    /// Guesses if the first row of a CSV file is a header based on the types of the
    /// first three rows.
    fn guess_csv_first_row_is_header(cell_values: &CellValues) -> bool {
        if cell_values.h < 3 {
            return false;
        }

        let text_type_id = CellValue::Text("".to_string()).type_id();
        let number_type_id = CellValue::Number(0.into()).type_id();

        let types = |row: usize| {
            cell_values
                .get_row(row as u32)
                .unwrap_or_default()
                .iter()
                .map(|c| c.type_id())
                .collect::<Vec<_>>()
        };

        let row_0 = types(0);
        let row_1 = types(1);
        let row_2 = types(2);

        // If we have column names that are blank, then probably not a header
        if row_0.iter().any(|t| *t == CellValue::Blank.type_id()) {
            return false;
        }

        // compares the two entries, ignoring Blank (type == 8) in b if ignore_empty
        let type_row_match =
            |a: &[u8], b: &[u8], ignore_empty: bool, match_text_number: bool| -> bool {
                if a.len() != b.len() {
                    return false;
                }

                for (t1, t2) in a.iter().zip(b.iter()) {
                    //
                    if ignore_empty
                        && (*t1 == CellValue::Blank.type_id() || *t2 == CellValue::Blank.type_id())
                    {
                        continue;
                    }
                    if t1 != t2 {
                        if !match_text_number {
                            return false;
                        }
                        if !((*t1 == number_type_id && *t2 == text_type_id)
                            || (*t1 == text_type_id && *t2 == number_type_id))
                        {
                            return false;
                        }
                    }
                }

                true
            };

        let row_0_is_different_from_row_1 =
            !type_row_match(row_0.as_slice(), row_1.as_slice(), false, false)
                || row_0.iter().all(|t| *t == text_type_id);
        let row_1_is_same_as_row_2 = type_row_match(row_1.as_slice(), row_2.as_slice(), true, true);

        row_0_is_different_from_row_1 && row_1_is_same_as_row_2
    }

    /// Overwrites meta information of the new data table based on the original data table.
    fn overwrite_data_table(self: &GridController, pos: SheetPos, dt: &mut DataTable) {
        dbgjs!(&pos);
        if let Some(sheet) = self.try_sheet(pos.sheet_id)
            && let Some(original) = sheet.data_table_at(&pos.into())
        {
            dbgjs!(&original.name);
            dt.name = original.name.clone();
            dt.alternating_colors = original.alternating_colors;
            dt.formats = original.formats.clone();
            dt.borders = original.borders.clone();
            dt.show_name = original.show_name;
            dt.show_columns = original.show_columns;
            dt.sort = original.sort.clone();

            // only copy the column headers and display buffer if the lengths are the same
            if dt.column_headers_len() == original.column_headers_len() {
                dt.column_headers = original.column_headers.clone();
                dt.display_buffer = original.display_buffer.clone();
            }
        }
    }

    /// Imports a CSV file into the grid.
    #[allow(clippy::too_many_arguments)]
    pub fn import_csv_operations(
        &mut self,
        sheet_id: SheetId,
        file: &[u8],
        file_name: &str,
        insert_at: Pos,
        delimiter: Option<u8>,
        create_table: Option<bool>,
        is_overwrite_table: bool,
    ) -> Result<(Vec<Operation>, String)> {
        let error = |message: String| anyhow!("Error parsing CSV file {}: {}", file_name, message);
        let sheet_pos = SheetPos::from((insert_at, sheet_id));

        let converted_file = clean_csv_file(file)?;

        let (d, width, height, is_table) = find_csv_info(&converted_file);
        let delimiter = delimiter.unwrap_or(d);

        let reader = |flexible| {
            csv::ReaderBuilder::new()
                .delimiter(delimiter)
                .has_headers(false)
                .flexible(flexible)
                .from_reader(converted_file.as_slice())
        };

        let mut cell_values = CellValues::new(width, height);

        let mut sheet_format_updates = SheetFormatUpdates::default();

        let mut y: u32 = 0;

        for entry in reader(true).records() {
            match entry {
                Err(e) => return Err(error(format!("line {}: {}", y + 1, e))),
                Ok(record) => {
                    for (x, value) in record.iter().enumerate() {
                        let (cell_value, format_update) =
                            CellValue::string_to_cell_value(value, false);

                        cell_values.set(x as u32, y, cell_value);

                        if !format_update.is_default() {
                            let pos = Pos {
                                x: x as i64 + 1,
                                y: y as i64 + 1,
                            };
                            sheet_format_updates.set_format_cell(pos, format_update);
                        }
                    }
                }
            }
            y += 1;

            // update the progress bar every time there's a new batch
            let should_update = y % IMPORT_LINES_PER_OPERATION == 0;

            if should_update && (cfg!(target_family = "wasm") || cfg!(test)) {
                crate::wasm_bindings::js::jsImportProgress(file_name, y, height);
            }
        }

        if cell_values.w == 0 || cell_values.h == 0 {
            bail!("CSV file is empty");
        }

        let mut ops = vec![];
        let response_prompt;

        let apply_first_row_as_header = match create_table {
            Some(true) => true,
            Some(false) => false,
            None => GridController::guess_csv_first_row_is_header(&cell_values),
        };

        if is_table && apply_first_row_as_header {
            let cell_values: Array = cell_values.into();

            let import = Import::new(sanitize_table_name(file_name.into()));
            let mut data_table =
                DataTable::from((import.to_owned(), cell_values, self.a1_context()));

            if !sheet_format_updates.is_default() {
                data_table
                    .formats
                    .get_or_insert_default()
                    .apply_updates(&sheet_format_updates);
            }

            data_table.apply_first_row_as_header();
            let output_rect = data_table.output_rect(sheet_pos.into(), true);
            let a1_selection = A1Selection::from_rect(output_rect.to_sheet_rect(sheet_id));
            response_prompt = format!(
                "Imported {} as a data table at {}",
                file_name,
                a1_selection.to_string(None, self.a1_context())
            );

            if is_overwrite_table {
                self.overwrite_data_table(sheet_pos, &mut data_table);
            }
            ops.push(Operation::SetDataTable {
                sheet_pos,
                data_table: Some(data_table),
                index: usize::MAX,
                ignore_old_data_table: true,
            });
            drop(sheet_format_updates);
        } else {
            let a1_selection = A1Selection::from_rect(SheetRect::from_numbers(
                sheet_pos.x,
                sheet_pos.y,
                cell_values.w as i64,
                cell_values.h as i64,
                sheet_id,
            ));
            response_prompt = format!(
                "Imported {} as a flat data in sheet at {}",
                file_name,
                a1_selection.to_string(None, self.a1_context())
            );
            ops.push(Operation::SetCellValues {
                sheet_pos,
                values: cell_values,
            });
            sheet_format_updates.translate_in_place(sheet_pos.x, sheet_pos.y);
            ops.push(Operation::SetCellFormatsA1 {
                sheet_id,
                formats: sheet_format_updates,
            });
        }

        Ok((ops, response_prompt))
    }

    /// Imports an Excel file into the grid.
    pub fn import_excel_operations(
        &mut self,
        file: &[u8],
        file_name: &str,
    ) -> Result<(Vec<Operation>, String)> {
        let mut ops: Vec<Operation> = vec![];
        let mut response_prompt = format!("Imported {} as sheets - ", file_name);
        let xlsx_range_to_pos = |(row, col)| Pos {
            x: col as i64 + 1,
            y: row as i64 + 1,
        };

        // detect file extension
        let path = Path::new(file_name);
        let extension = path.extension().and_then(|e| e.to_str());
        let cursor = Cursor::new(file);
        let mut workbook = match extension {
            Some("xls") | Some("xla") => Sheets::Xls(
                open_workbook_from_rs(cursor)
                    .map_err(|e| anyhow!("Failed to open XLS workbook '{file_name}': {e}"))?,
            ),
            Some("xlsx") | Some("xlsm") | Some("xlam") => Sheets::Xlsx(
                open_workbook_from_rs(cursor)
                    .map_err(|e| anyhow!("Failed to open XLSX workbook '{file_name}': {e}"))?,
            ),
            Some("xlsb") => Sheets::Xlsb(
                open_workbook_from_rs(cursor)
                    .map_err(|e| anyhow!("Failed to open XLSB workbook '{file_name}': {e}"))?,
            ),
            Some("ods") => Sheets::Ods(
                open_workbook_from_rs(cursor)
                    .map_err(|e| anyhow!("Failed to open ODS workbook '{file_name}': {e}"))?,
            ),
            _ => {
                return Err(anyhow!(
                    "Cannot detect file format for '{file_name}' (extension: {:?})",
                    extension
                ));
            }
        };

        let sheets = workbook.sheet_names().to_owned();

        // Collect named ranges with pre-compiled regex patterns for efficient replacement.
        // Word boundaries (\b) ensure we only match complete identifiers, so order doesn't matter.
        let named_ranges: Vec<NamedRangeReplacement> = workbook
            .defined_names()
            .iter()
            .filter_map(|(name, reference)| {
                let pattern = Regex::new(&format!(r"\b{}\b", regex::escape(name))).ok()?;
                // Escape $ in replacement string to prevent backreference interpretation
                let replacement = reference.replace('$', "$$");
                Some(NamedRangeReplacement {
                    name: name.clone(),
                    pattern,
                    replacement,
                })
            })
            .collect();

        // total rows for calculating import progress
        let total_rows = sheets
            .iter()
            .try_fold(0, |acc, sheet_name| {
                let range = workbook.worksheet_range(sheet_name)?;
                // counted twice because we have to read values and formulas
                Ok(acc + 2 * range.rows().count())
            })
            .map_err(|e: CalamineError| {
                anyhow!(
                    "Failed to calculate total rows in '{file_name}' while reading sheet ranges: {e}"
                )
            })?;
        let mut current_y_values = 0;
        let mut current_y_formula = 0;

        let mut gc = GridController::new_blank();

        // add all sheets to the grid, this is required for sheet name parsing in cell ref
        for sheet_name in sheets.iter() {
            gc.server_add_sheet_with_name(sheet_name.to_owned());
        }

        let formula_start_name = unique_data_table_name("Formula1", false, None, self.a1_context());

        // add data from excel file to grid
        for sheet_name in sheets.iter() {
            let sheet = gc.try_sheet_from_name(sheet_name).ok_or_else(|| {
                anyhow!(
                    "Failed to find sheet '{sheet_name}' in '{file_name}' after creation (internal error)"
                )
            })?;
            let sheet_id = sheet.id;

            // values
            let range = workbook.worksheet_range(sheet_name).map_err(|e| {
                anyhow!("Failed to read values from sheet '{sheet_name}' in '{file_name}': {e}")
            })?;
            let values_insert_at = range.start().map_or_else(|| pos![A1], xlsx_range_to_pos);
            for (y, row) in range.rows().enumerate() {
                for (x, cell) in row.iter().enumerate() {
                    let cell_value = match cell {
                        ExcelData::Empty => continue,
                        ExcelData::String(value) => CellValue::Text(value.to_string()),
                        ExcelData::DateTimeIso(value) => CellValue::unpack_date_time(value)
                            .unwrap_or(CellValue::Text(value.to_string())),
                        ExcelData::DateTime(value) => {
                            if value.is_datetime() {
                                value.as_datetime().map_or_else(
                                    || CellValue::Blank,
                                    |v| {
                                        // there's probably a better way to figure out if it's a Date or a DateTime, but this works for now
                                        if let (Ok(zero_time), Ok(zero_date)) = (
                                            NaiveTime::parse_from_str("00:00:00", "%H:%M:%S"),
                                            NaiveDate::parse_from_str("1899-12-31", "%Y-%m-%d"),
                                        ) {
                                            if v.time() == zero_time {
                                                CellValue::Date(v.date())
                                            } else if v.date() == zero_date {
                                                CellValue::Time(v.time())
                                            } else {
                                                CellValue::DateTime(v)
                                            }
                                        } else {
                                            CellValue::DateTime(v)
                                        }
                                    },
                                )
                            } else {
                                CellValue::Text(value.to_string())
                            }
                        }
                        ExcelData::DurationIso(value) => CellValue::Text(value.to_string()),
                        ExcelData::Float(value) => {
                            CellValue::unpack_str_float(&value.to_string(), CellValue::Blank)
                        }
                        ExcelData::Int(value) => {
                            CellValue::unpack_str_float(&value.to_string(), CellValue::Blank)
                        }
                        ExcelData::Error(_) => continue,
                        ExcelData::Bool(value) => CellValue::Logical(*value),
                    };

                    let pos = Pos {
                        x: values_insert_at.x + x as i64,
                        y: values_insert_at.y + y as i64,
                    };
                    let sheet = gc.try_sheet_mut(sheet_id).ok_or_else(|| {
                        anyhow!(
                            "Failed to access sheet '{sheet_name}' (id: {sheet_id}) for setting value at row {y}, col {x} in '{file_name}'"
                        )
                    })?;
                    sheet.set_value(pos, cell_value);
                }

                // send progress to the client, every IMPORT_LINES_PER_OPERATION
                if (cfg!(target_family = "wasm") || cfg!(test))
                    && current_y_values % IMPORT_LINES_PER_OPERATION == 0
                {
                    crate::wasm_bindings::js::jsImportProgress(
                        file_name,
                        current_y_values + current_y_formula,
                        total_rows as u32,
                    );
                }
                current_y_values += 1;
            }

            // formulas
            let formula = workbook.worksheet_formula(sheet_name).map_err(|e| {
                anyhow!("Failed to read formulas from sheet '{sheet_name}' in '{file_name}': {e}")
            })?;
            let formulas_insert_at = formula.start().map_or_else(Pos::default, xlsx_range_to_pos);

            for (y, row) in formula.rows().enumerate() {
                for (x, cell) in row.iter().enumerate() {
                    if !cell.is_empty() {
                        let pos = Pos {
                            x: formulas_insert_at.x + x as i64,
                            y: formulas_insert_at.y + y as i64,
                        };
                        let sheet_pos = pos.to_sheet_pos(sheet_id);
                        let sheet = gc.try_sheet_mut_result(sheet_id)?;
                        let code = cell.to_string();

                        // Replace all named ranges in the formula with their references
                        let code = replace_named_ranges(&code, &named_ranges);

                        sheet.data_table_insert_full(
                            sheet_pos.into(),
                            DataTable::new(
                                DataTableKind::CodeRun(CodeRun {
                                    language: CodeCellLanguage::Formula,
                                    code: code.clone(),
                                    ..Default::default()
                                }),
                                &formula_start_name,
                                Value::Single(CellValue::Blank),
                                false,
                                None,
                                None,
                                None,
                            ),
                        );

                        let mut transaction = PendingTransaction {
                            source: TransactionSource::Server,
                            ..Default::default()
                        };

                        gc.add_formula_without_eval(
                            &mut transaction,
                            sheet_pos,
                            &code,
                            formula_start_name.as_str(),
                        );
                        gc.update_a1_context_table_map(&mut transaction);
                    }
                }

                // send progress to the client, every IMPORT_LINES_PER_OPERATION
                if (cfg!(target_family = "wasm") || cfg!(test))
                    && current_y_formula % IMPORT_LINES_PER_OPERATION == 0
                {
                    crate::wasm_bindings::js::jsImportProgress(
                        file_name,
                        current_y_values + current_y_formula,
                        total_rows as u32,
                    );
                }
                current_y_formula += 1;
            }

            // styles
            let style_range = workbook.worksheet_style(sheet_name).map_err(|e| {
                anyhow!("Failed to read styles from sheet '{sheet_name}' in '{file_name}': {e}")
            })?;
            let style_insert_at = style_range
                .start()
                .map_or_else(|| pos![A1], xlsx_range_to_pos);

            for (y, x, style) in style_range.cells() {
                let pos = Pos {
                    x: style_insert_at.x + x as i64,
                    y: style_insert_at.y + y as i64,
                };

                let sheet = gc.try_sheet_mut_result(sheet_id)?;

                // font formatting (only if font info exists)
                if let Some(font) = style.get_font() {
                    font.is_bold()
                        .then(|| sheet.formats.bold.set(pos, Some(true)));
                    font.is_italic()
                        .then(|| sheet.formats.italic.set(pos, Some(true)));
                    font.has_underline()
                        .then(|| sheet.formats.underline.set(pos, Some(true)));
                    font.has_strikethrough()
                        .then(|| sheet.formats.strike_through.set(pos, Some(true)));
                    font.color.and_then(|color| {
                        // Only set text color if it's not the default black color
                        // Default black (0,0,0) is likely returned by calamine even when no explicit color is set
                        if !color.is_black() {
                            sheet.formats.text_color.set(pos, Some(color.to_string()))
                        } else {
                            None
                        }
                    });
                    if let Some(size) = font.size {
                        // Only set font size if it's not the default Excel size (11pt)
                        if size != DEFAULT_FONT_SIZE {
                            // Convert Excel font size to internal representation
                            // Internal = Excel - FONT_SIZE_DISPLAY_ADJUSTMENT (which is -4)
                            // So Excel 14pt becomes internal 18, displaying as 14 in Quadratic
                            let internal_size = size.round() as i16 - FONT_SIZE_DISPLAY_ADJUSTMENT;
                            sheet.formats.font_size.set(pos, Some(internal_size));
                        }
                    }
                }

                // fill color (independent of font)
                style
                    .get_fill()
                    .and_then(|fill| fill.get_color())
                    .and_then(|color| sheet.formats.fill_color.set(pos, Some(color.to_string())));

                // alignment (independent of font)
                if let Some(alignment) = style.get_alignment() {
                    // horizontal alignment
                    sheet.formats.align.set(
                        pos,
                        match alignment.horizontal {
                            HorizontalAlignment::Left => Some(CellAlign::Left),
                            HorizontalAlignment::Center => Some(CellAlign::Center),
                            HorizontalAlignment::Right => Some(CellAlign::Right),
                            _ => None,
                        },
                    );

                    // vertical alignment
                    sheet.formats.vertical_align.set(
                        pos,
                        match alignment.vertical {
                            VerticalAlignment::Top => Some(CellVerticalAlign::Top),
                            VerticalAlignment::Center => Some(CellVerticalAlign::Middle),
                            VerticalAlignment::Bottom => Some(CellVerticalAlign::Bottom),
                            _ => None,
                        },
                    );

                    // wrap text
                    if alignment.wrap_text {
                        sheet.formats.wrap.set(pos, Some(CellWrap::Wrap));
                    }

                    // shrink to fit
                    if alignment.shrink_to_fit {
                        sheet.formats.wrap.set(pos, Some(CellWrap::Clip));
                    }
                }

                // number formats (independent of font)
                if let Some(number_format) = style.get_number_format() {
                    import_excel_number_format(sheet, pos, number_format);
                }

                // borders (independent of font)
                if let Some(border) = style.get_borders() {
                    let border_style_cell = convert_excel_borders_to_quadratic(border);
                    if !border_style_cell.is_empty() {
                        sheet.borders.set_style_cell(pos, border_style_cell);
                    }
                }
            }

            // layout
            let layout = workbook.worksheet_layout(sheet_name).map_err(|e| {
                anyhow!("Failed to read layout from sheet '{sheet_name}' in '{file_name}': {e}")
            })?;
            let sheet = gc.try_sheet_mut_result(sheet_id)?;

            for (_, column_width) in layout.column_widths.iter() {
                let column = column_width.column as i64 + 1;
                sheet
                    .offsets
                    .set_column_width(column, column_width.width * COLUMN_WIDTH_MULTIPLIER);
            }

            for (_, row_height) in layout.row_heights.iter() {
                let row = row_height.row as i64 + 1;
                sheet
                    .offsets
                    .set_row_height(row, row_height.height * ROW_HEIGHT_MULTIPLIER);
            }
        }

        // rerun all formulas in-order
        let compute_ops = gc.rerun_all_code_cells_operations();
        gc.server_apply_transaction(compute_ops, None);

        // handle sheet name duplicates from excel files
        let mut gc_duplicate_name = GridController::new_blank();
        for sheet_name in self.sheet_names() {
            gc_duplicate_name.server_add_sheet_with_name(sheet_name.to_owned());
        }
        for new_sheet_name in sheets.iter() {
            let unique_sheet_name = gc_duplicate_name.grid.unique_sheet_name(new_sheet_name);
            let sheet_id = gc
                .try_sheet_from_name(new_sheet_name)
                .ok_or_else(|| {
                    anyhow!(
                        "Failed to find sheet '{new_sheet_name}' while processing duplicate names in '{file_name}' (internal error)"
                    )
                })?
                .id;
            gc.grid.update_sheet_name(sheet_id, &unique_sheet_name)?;
            gc_duplicate_name.server_add_sheet_with_name(unique_sheet_name);
        }

        for (index, sheet) in gc.grid.sheets.into_values().enumerate() {
            if index == 0 {
                response_prompt += &sheet.name;
            } else {
                response_prompt += &format!(", {}", sheet.name);
            }

            // replace the first sheet if the grid is empty
            if index == 0 && self.grid.is_empty() {
                ops.push(Operation::ReplaceSheet {
                    sheet_id: self.grid.first_sheet_id(),
                    sheet: Box::new(sheet),
                });
            } else {
                ops.push(Operation::AddSheet {
                    sheet: Box::new(sheet),
                });
            }
        }

        Ok((ops, response_prompt))
    }

    /// Imports a Parquet file into the grid.
    pub fn import_parquet_operations(
        &mut self,
        sheet_id: SheetId,
        file: Vec<u8>,
        file_name: &str,
        insert_at: Pos,
        updater: Option<impl Fn(&str, u32, u32)>,
        is_overwrite_table: bool,
    ) -> Result<(Vec<Operation>, String)> {
        let cell_values = parquet_to_array(file, file_name, updater)?;
        let context = self.a1_context();
        let import = Import::new(sanitize_table_name(file_name.into()));
        let mut data_table = DataTable::from((import.to_owned(), cell_values, context));
        data_table.apply_first_row_as_header();

        let output_rect = data_table.output_rect(insert_at, true);
        let a1_selection = A1Selection::from_rect(output_rect.to_sheet_rect(sheet_id));
        let response_prompt = format!(
            "Imported {} as a data table at {}",
            file_name,
            a1_selection.to_string(None, self.a1_context())
        );
        if is_overwrite_table {
            self.overwrite_data_table(SheetPos::from((insert_at, sheet_id)), &mut data_table);
        }

        let ops = vec![Operation::SetDataTable {
            sheet_pos: SheetPos::from((insert_at, sheet_id)),
            data_table: Some(data_table),
            index: usize::MAX,
            ignore_old_data_table: true,
        }];

        Ok((ops, response_prompt))
    }
}

/// Converts Excel number format to our quadratic format.
fn import_excel_number_format(sheet: &mut Sheet, pos: Pos, number_format: &NumberFormat) {
    let format_id = number_format.format_id;
    let format_string = &number_format.format_code;

    // parse format sections separated by semicolons, ignore negative section
    // Excel format: positive;negative;zero;text
    let format_sections: Vec<&str> = format_string.split(';').collect();

    // Guard against empty format strings
    if format_sections.is_empty() {
        return; // Nothing to apply if there are no format sections
    }

    // determine which format section to use based on cell value
    let current_value = sheet.cell_value(pos);
    let active_format = match current_value {
        // use zero format if available, otherwise positive format
        Some(CellValue::Number(ref n)) => {
            if let Some(f64_val) = n.to_f64() {
                if f64_val == 0.0 && format_sections.len() >= 3 {
                    format_sections[2]
                } else {
                    format_sections[0]
                }
            } else {
                format_sections[0]
            }
        }
        // use text format if available, otherwise positive format
        Some(CellValue::Text(_)) => {
            if format_sections.len() >= 4 {
                format_sections[3]
            } else {
                format_sections[0]
            }
        }
        // default to positive format
        _ => format_sections[0],
    };

    if let Some(format_id) = format_id {
        match format_id {
            // general format - preserve number precision like excel
            0 => {
                // for general format, excel displays significant decimal places.
                // excel shows full precision up to about 15 significant digits.
                if let Some(CellValue::Number(ref n)) = sheet.cell_value(pos)
                    && let Some(f64_val) = n.to_f64()
                {
                    // check if this is not a whole number
                    if f64_val.fract() != 0.0 {
                        // use high precision formatting to capture all significant digits
                        let num_str = format!("{f64_val:.15}");
                        if let Some(decimal_pos) = num_str.find('.') {
                            let after_decimal = &num_str[decimal_pos + 1..];

                            // for general format, excel typically preserves trailing zeros when they
                            // represent the actual precision of the stored number. we'll use the full
                            // precision available in the f64 representation.
                            let decimal_places = after_decimal.len();

                            // excel's general format shows meaningful precision up to 15 digits
                            if decimal_places > 0 {
                                sheet
                                    .formats
                                    .numeric_decimals
                                    .set(pos, Some(decimal_places as i16));
                            }
                        }
                    }
                }
            }

            // number formats (1-4, 37-40)

            // "0" - integer
            1 => {
                sheet.formats.numeric_decimals.set(pos, Some(0));
            }
            // "0.00" - two decimal places (0.00)
            2 => {
                sheet.formats.numeric_decimals.set(pos, Some(2));
            }
            // "#,##0" - thousands separator (#,##0)
            3 => {
                sheet.formats.numeric_commas.set(pos, Some(true));
                sheet.formats.numeric_decimals.set(pos, Some(0));
            }
            // "#,##0.00" - thousands separator with decimals
            4 => {
                sheet.formats.numeric_commas.set(pos, Some(true));
                sheet.formats.numeric_decimals.set(pos, Some(2));
            }

            // formats with thousands separators
            37..=40 => {
                sheet.formats.numeric_commas.set(pos, Some(true));
                let has_decimals = format_id == 39 || format_id == 40;
                let decimals = if has_decimals { 2 } else { 0 };
                sheet.formats.numeric_decimals.set(pos, Some(decimals));
            }

            // currency formats
            5..=8 | 41..=44 => {
                let numeric_format = NumericFormat {
                    kind: NumericFormatKind::Currency,
                    symbol: Some("$".to_string()),
                };
                sheet.formats.numeric_format.set(pos, Some(numeric_format));

                // set decimal places based on format
                let has_decimals =
                    format_id == 7 || format_id == 8 || format_id == 43 || format_id == 44;
                let decimals = if has_decimals { 2 } else { 0 };
                sheet.formats.numeric_decimals.set(pos, Some(decimals));
                sheet.formats.numeric_commas.set(pos, Some(true));
            }

            // percentage formats

            // "0%" - percentage format
            9 => {
                let numeric_format = NumericFormat {
                    kind: NumericFormatKind::Percentage,
                    symbol: None,
                };
                sheet.formats.numeric_format.set(pos, Some(numeric_format));
                sheet.formats.numeric_decimals.set(pos, Some(0));
            }
            // "0.00%" - percentage format with decimals
            10 => {
                let numeric_format = NumericFormat {
                    kind: NumericFormatKind::Percentage,
                    symbol: None,
                };
                sheet.formats.numeric_format.set(pos, Some(numeric_format));
                sheet.formats.numeric_decimals.set(pos, Some(2));
            }

            // scientific formats
            11 | 48 => {
                let numeric_format = NumericFormat {
                    kind: NumericFormatKind::Exponential,
                    symbol: None,
                };
                sheet.formats.numeric_format.set(pos, Some(numeric_format));
                let decimals = if format_id == 11 { 2 } else { 1 };
                sheet.formats.numeric_decimals.set(pos, Some(decimals));
            }

            // fraction formats
            12 | 13 => {
                // These are fraction formats: "# ?/?" and "# ??/??"
                // For now, we'll treat them as general numeric without special formatting
                // TODO: Add proper fraction formatting support
            }

            // date formats
            14..=17 | 22 => {
                let chrono_format = match format_id {
                    14 => excel_to_chrono_format("m/d/yyyy"),    // "%-m/%-d/%Y"
                    15 => excel_to_chrono_format("d-mmm-yy"),    // "%-d-%b-%y"
                    16 => excel_to_chrono_format("d-mmm"),       // "%-d-%b"
                    17 => excel_to_chrono_format("mmm-yy"),      // "%b-%y"
                    22 => excel_to_chrono_format("m/d/yy h:mm"), // "%-m/%-d/%y %-I:%M"
                    _ => DEFAULT_DATE_FORMAT.to_string(),
                };

                // set the format
                sheet
                    .formats
                    .date_time
                    .set(pos, Some(chrono_format.to_string()));

                // convert numeric value to date/time if needed
                if let Some(CellValue::Number(ref n)) = sheet.cell_value(pos)
                    && let Some(f64_val) = n.to_f64()
                {
                    let is_datetime = format_id == 22; // m/d/yy h:mm
                    let converted_value = if is_datetime {
                        excel_serial_to_date_time(f64_val, true, true, true)
                    } else {
                        excel_serial_to_date_time(f64_val, true, false, false)
                    };
                    if let Some(new_value) = converted_value {
                        sheet.set_value(pos, new_value);
                    }
                }
            }

            // time formats
            18..=21 | 45..=47 => {
                let chrono_format = match format_id {
                    18 => excel_to_chrono_format("h:mm AM/PM"), // "%-I:%M %p"
                    19 => excel_to_chrono_format("h:mm:ss AM/PM"), // "%-I:%M:%S %p"
                    20 => excel_to_chrono_format("h:mm"),       // "%-I:%M"
                    21 => excel_to_chrono_format("h:mm:ss"),    // "%-I:%M:%S"
                    45 => excel_to_chrono_format("mm:ss"),      // "%M:%S"
                    46 => excel_to_chrono_format("[h]:mm:ss"),  // "[h]:%M:%S" (elapsed)
                    47 => excel_to_chrono_format("mm:ss.0"),    // "%M:%S.0"
                    _ => DEFAULT_TIME_FORMAT.to_string(),
                };

                // set the format
                sheet
                    .formats
                    .date_time
                    .set(pos, Some(chrono_format.to_string()));

                // convert numeric value to time if needed
                if let Some(CellValue::Number(ref n)) = sheet.cell_value(pos)
                    && let Some(f64_val) = n.to_f64()
                {
                    let converted_value = excel_serial_to_date_time(f64_val, false, true, false);
                    if let Some(new_value) = converted_value {
                        sheet.set_value(pos, new_value);
                    }
                }
            }

            // text format, noop
            49 => {}

            // custom formats - parse the format string
            _ => {
                if !active_format.is_empty() {
                    // handle custom date/time formats
                    if is_excel_datetime_format(active_format) {
                        let chrono_format = excel_to_chrono_format(active_format);
                        sheet.formats.date_time.set(pos, Some(chrono_format));

                        // convert numeric value to datetime if needed
                        if let Some(CellValue::Number(ref n)) = sheet.cell_value(pos)
                            && let Some(f64_val) = n.to_f64()
                        {
                            let converted_value =
                                excel_serial_to_date_time(f64_val, true, true, true);
                            if let Some(new_value) = converted_value {
                                sheet.set_value(pos, new_value);
                            }
                        }
                    } else if is_excel_date_format(active_format) {
                        let chrono_format = excel_to_chrono_format(active_format);
                        sheet.formats.date_time.set(pos, Some(chrono_format));

                        // convert numeric value to date if needed
                        if let Some(CellValue::Number(ref n)) = sheet.cell_value(pos)
                            && let Some(f64_val) = n.to_f64()
                        {
                            let converted_value =
                                excel_serial_to_date_time(f64_val, true, false, false);
                            if let Some(new_value) = converted_value {
                                sheet.set_value(pos, new_value);
                            }
                        }
                    } else if is_excel_time_format(active_format) {
                        let chrono_format = excel_to_chrono_format(active_format);
                        sheet.formats.date_time.set(pos, Some(chrono_format));

                        // convert numeric value to time if needed
                        if let Some(CellValue::Number(ref n)) = sheet.cell_value(pos)
                            && let Some(f64_val) = n.to_f64()
                        {
                            let converted_value =
                                excel_serial_to_date_time(f64_val, false, true, false);
                            if let Some(new_value) = converted_value {
                                sheet.set_value(pos, new_value);
                            }
                        }
                    } else {
                        import_excel_number_format_string(sheet, pos, active_format);
                    }
                }
            }
        }
    } else if !active_format.is_empty() {
        import_excel_number_format_string(sheet, pos, active_format);
    }
}

/// Handles custom number formats that don't have a format_id.
fn import_excel_number_format_string(sheet: &mut Sheet, pos: Pos, format_string: &str) {
    let count_decimal_places = |format_str: &str| -> i16 {
        if let Some(decimal_pos) = format_str.find('.') {
            let after_decimal = &format_str[decimal_pos + 1..];
            after_decimal
                .chars()
                .take_while(|c| *c == '0' || *c == '#')
                .count() as i16
        } else {
            0
        }
    };

    let has_thousands_separator =
        |format_str: &str| -> bool { format_str.contains("#,##") || format_str.contains("0,00") };

    // handle cases where we only have a format string but no format_id
    if is_excel_datetime_format(format_string) {
        let chrono_format = excel_to_chrono_format(format_string);
        sheet.formats.date_time.set(pos, Some(chrono_format));

        // convert numeric value to datetime if needed
        if let Some(CellValue::Number(ref n)) = sheet.cell_value(pos)
            && let Some(f64_val) = n.to_f64()
        {
            let converted_value = excel_serial_to_date_time(f64_val, true, true, true);
            if let Some(new_value) = converted_value {
                sheet.set_value(pos, new_value);
            }
        }
    } else if is_excel_date_format(format_string) {
        let chrono_format = excel_to_chrono_format(format_string);
        sheet.formats.date_time.set(pos, Some(chrono_format));

        // convert numeric value to date if needed
        if let Some(CellValue::Number(ref n)) = sheet.cell_value(pos)
            && let Some(f64_val) = n.to_f64()
        {
            let converted_value = excel_serial_to_date_time(f64_val, true, false, false);
            if let Some(new_value) = converted_value {
                sheet.set_value(pos, new_value);
            }
        }
    } else if is_excel_time_format(format_string) {
        let chrono_format = excel_to_chrono_format(format_string);
        sheet.formats.date_time.set(pos, Some(chrono_format));

        // convert numeric value to time if needed
        if let Some(CellValue::Number(ref n)) = sheet.cell_value(pos)
            && let Some(f64_val) = n.to_f64()
        {
            let converted_value = excel_serial_to_date_time(f64_val, false, true, false);
            if let Some(new_value) = converted_value {
                sheet.set_value(pos, new_value);
            }
        }
    } else {
        // handle numeric formats
        if format_string.contains('%') {
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            };
            sheet.formats.numeric_format.set(pos, Some(numeric_format));
        } else if format_string.contains('$') {
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            };
            sheet.formats.numeric_format.set(pos, Some(numeric_format));
        } else if format_string.to_uppercase().contains('E') {
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Exponential,
                symbol: None,
            };
            sheet.formats.numeric_format.set(pos, Some(numeric_format));
        }

        // set decimal places
        let decimals = count_decimal_places(format_string);
        sheet.formats.numeric_decimals.set(pos, Some(decimals));

        // set thousands separator
        if has_thousands_separator(format_string) {
            sheet.formats.numeric_commas.set(pos, Some(true));
        }
    }
}

/// Converts Excel format strings to Chrono format strings
fn excel_to_chrono_format(excel_format: &str) -> String {
    let mut result = String::new();
    let mut chars = excel_format.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            // year
            'y' => {
                let mut y_count = 1;
                while chars.peek() == Some(&'y') {
                    chars.next();
                    y_count += 1;
                }
                if y_count >= 4 {
                    result.push_str("%Y"); // Full year (e.g., 2025)
                } else {
                    result.push_str("%y"); // Two-digit year (e.g., 25)
                }
            }

            // month
            'm' | 'M' => {
                // determine if this is a month or a minute
                let remaining: String = chars.clone().collect();
                let prev_chars: String = result
                    .chars()
                    .rev()
                    .take(5)
                    .collect::<String>()
                    .chars()
                    .rev()
                    .collect();

                // special case: if the entire format is time-only (no date components), treat all 'm' as minutes
                let is_time_only_format = !excel_format.contains('y')
                    && !excel_format.contains('d')
                    && !excel_format.contains('/')
                    && !excel_format.contains('-')
                    && (excel_format.contains(':')
                        || excel_format.contains('s')
                        || excel_format.contains('h'));

                // it's a minute if we have immediate time context:
                // 1. Preceded by ':' or hour format
                // 2. Followed by ':' or seconds
                // 3. Between time components
                let immediately_after_time = prev_chars.ends_with(':')
                    || prev_chars.ends_with("%I")
                    || prev_chars.ends_with("%H")
                    || prev_chars.ends_with("I ")
                    || prev_chars.ends_with("H ");

                let immediately_before_time =
                    remaining.starts_with(':') || remaining.starts_with('s');

                // probably month if followed by date separators
                let likely_month = remaining.starts_with('/') ||
                             remaining.starts_with('-') ||
                             remaining.starts_with('.') ||
                             (prev_chars.is_empty() && !is_time_only_format) || // at the beginning of date format
                             prev_chars.ends_with('/') ||
                             prev_chars.ends_with('-') ||
                             prev_chars.ends_with('.');

                let mut m_count = 1;
                let ch_lower = ch.to_lowercase().next().unwrap();
                while chars.peek() == Some(&ch_lower)
                    || chars.peek() == Some(&ch.to_uppercase().next().unwrap())
                {
                    chars.next();
                    m_count += 1;
                }

                if is_time_only_format
                    || ((immediately_after_time || immediately_before_time) && !likely_month)
                {
                    // minutes
                    if m_count >= 2 {
                        result.push_str("%M"); // minutes with zero padding
                    } else {
                        result.push_str("%-M"); // minutes without padding
                    }
                } else {
                    // months
                    match m_count {
                        1 => result.push_str("%-m"), // month (1-12)
                        2 => result.push_str("%m"),  // month (01-12)
                        3 => result.push_str("%b"),  // abbreviated month name
                        4 => result.push_str("%B"),  // full month name
                        5 => result.push_str("%b"),  // first letter of month
                        _ => result.push_str("%m"),  // month (01-12)
                    }
                }
            }

            // day
            'd' => {
                let mut d_count = 1;
                while chars.peek() == Some(&'d') {
                    chars.next();
                    d_count += 1;
                }
                match d_count {
                    1 => result.push_str("%-d"), // day (1-31)
                    2 => result.push_str("%d"),  // day (01-31)
                    3 => result.push_str("%a"),  // abbreviated weekday name
                    4 => result.push_str("%A"),  // full weekday name
                    _ => result.push_str("%d"),  // day (01-31)
                }
            }

            // hour
            'h' | 'H' => {
                let mut h_count = 1;
                let ch_lower = ch.to_lowercase().next().unwrap();
                while chars.peek() == Some(&ch_lower)
                    || chars.peek() == Some(&ch.to_uppercase().next().unwrap())
                {
                    chars.next();
                    h_count += 1;
                }
                if h_count >= 2 {
                    result.push_str("%H"); // 24-hour format with zero padding
                } else {
                    result.push_str("%-I"); // 12-hour format without padding (e.g. 12:00)
                }
            }

            // second
            's' | 'S' => {
                let mut s_count = 1;
                let ch_lower = ch.to_lowercase().next().unwrap();
                while chars.peek() == Some(&ch_lower)
                    || chars.peek() == Some(&ch.to_uppercase().next().unwrap())
                {
                    chars.next();
                    s_count += 1;
                }
                if s_count >= 2 {
                    result.push_str("%S"); // seconds with zero padding
                } else {
                    result.push_str("%-S"); // seconds without padding
                }
            }

            // am/pm
            'A' => {
                // look ahead to see if this is "AM/PM" or "A/P"
                let remaining: String = chars.clone().collect();
                if remaining.starts_with("M/PM") {
                    result.push_str("%p");
                    // skip "M/PM"
                    chars.next(); // skip 'M'
                    chars.next(); // skip '/'
                    chars.next(); // skip 'P'
                    chars.next(); // skip 'M'
                } else if remaining.starts_with("/P") {
                    result.push_str("%p");
                    // skip "/P"
                    chars.next(); // skip '/'
                    chars.next(); // skip 'P'
                } else {
                    result.push(ch);
                }
            }

            // pm
            'P' => {
                if result.ends_with("AM/") {
                    // replace the "AM/" at the end with "%p"
                    result.truncate(result.len() - 3);
                    result.push_str("%p");
                    if chars.peek() == Some(&'M') {
                        chars.next(); // skip 'M'
                    }
                } else {
                    result.push(ch);
                }
            }

            // elapsed time
            '[' => {
                result.push(ch);
                // for elapsed time formats, preserve content inside brackets as-is
                for bracket_ch in chars.by_ref() {
                    result.push(bracket_ch);
                    if bracket_ch == ']' {
                        break;
                    }
                }
            }
            ']' => {
                // this should not be reached if '[' handling is correct
                result.push(ch);
            }

            // pass through other characters
            _ => {
                result.push(ch);
            }
        }
    }

    result
}

// Excel date format
fn is_excel_date_format(format_str: &str) -> bool {
    let format_lower = format_str.to_lowercase();

    // If it's clearly a time-only format, it's not a date format
    if is_time_only_format(&format_lower) {
        return false;
    }

    format_lower.contains("dd")
        || format_lower.contains("yy")
        || format_lower.contains("d-")
        || format_lower.contains("m/")
        || format_lower.contains("/d")
        || format_lower.contains("mmm")
        || format_lower.contains("mmmm")
        || (format_lower.contains("mm") && !is_likely_minutes(&format_lower))
}

// Helper function to detect time-only formats
fn is_time_only_format(format_lower: &str) -> bool {
    // If it contains time indicators and no date indicators, it's time-only
    let has_time_indicators = format_lower.contains("h:")
        || format_lower.contains(":mm")
        || format_lower.contains(":ss")
        || format_lower.contains("am/pm")
        || format_lower.contains("a/p")
        || format_lower.contains("[h]")
        || format_lower.contains("[mm]")
        || format_lower.contains("[ss]");

    let has_date_indicators = format_lower.contains("dd")
        || format_lower.contains("yy")
        || format_lower.contains("mmm")
        || format_lower.contains("mmmm")
        || format_lower.contains("/")
        || format_lower.contains("-");

    has_time_indicators && !has_date_indicators
}

// Helper function to detect if "mm" likely refers to minutes rather than months
fn is_likely_minutes(format_lower: &str) -> bool {
    // "mm" is likely minutes if it's preceded by ":" or followed by ":"
    format_lower.contains(":mm") || format_lower.contains("mm:")
}

// Excel time format
fn is_excel_time_format(format_str: &str) -> bool {
    let format_lower = format_str.to_lowercase();
    format_lower.contains("h:")
        || format_lower.contains("mm:")
        || format_lower.contains(":ss")
        || format_lower.contains("am/pm")
        || format_lower.contains("a/p")
        || format_lower.contains("[h]")
        || format_lower.contains("[mm]")
        || format_lower.contains("[ss]")
}

// Excel datetime format
fn is_excel_datetime_format(format_str: &str) -> bool {
    is_excel_date_format(format_str) && is_excel_time_format(format_str)
}

// Helper function to convert Excel serial date to CellValue
fn excel_serial_to_date_time(
    serial: f64,
    is_date: bool,
    is_time: bool,
    is_datetime: bool,
) -> Option<CellValue> {
    // Excel epoch is January 1, 1900 (but Excel treats 1900 as a leap year incorrectly)
    // We need to account for this by using the chrono crate's handling of Excel dates

    if is_datetime {
        // Combined date and time format - handles both components regardless of is_date/is_time flags
        let adjusted_serial = if serial >= 60.0 { serial - 1.0 } else { serial };
        let days = adjusted_serial.floor() as i64;
        let time_fraction = adjusted_serial.fract();

        if let Some(base_date) = NaiveDate::from_ymd_opt(1899, 12, 30)
            && let Some(date) = base_date.checked_add_days(chrono::Days::new(days as u64))
        {
            let total_seconds = (time_fraction * 86400.0) as i64;
            let hours = total_seconds / 3600;
            let minutes = (total_seconds % 3600) / 60;
            let seconds = total_seconds % 60;

            if let Some(time) =
                NaiveTime::from_hms_opt(hours as u32, minutes as u32, seconds as u32)
            {
                return Some(CellValue::DateTime(date.and_time(time)));
            }
        }
    } else if is_time && !is_date {
        // Pure time format - fractional part represents time
        let total_seconds = (serial.fract() * 86400.0) as i64;
        let hours = total_seconds / 3600;
        let minutes = (total_seconds % 3600) / 60;
        let seconds = total_seconds % 60;

        if let Some(time) = NaiveTime::from_hms_opt(hours as u32, minutes as u32, seconds as u32) {
            return Some(CellValue::Time(time));
        }
    } else if is_date && !is_time {
        // Pure date format
        // excel serial date 1 = January 1, 1900, but Excel incorrectly treats 1900 as leap year
        // serial 60 = Feb 29, 1900 (invalid), so we adjust
        let adjusted_serial = if serial >= 60.0 { serial - 1.0 } else { serial };

        if let Some(base_date) = NaiveDate::from_ymd_opt(1899, 12, 30)
            && let Some(date) =
                base_date.checked_add_days(chrono::Days::new(adjusted_serial as u64))
        {
            return Some(CellValue::Date(date));
        }
    }

    None
}

/// Converts calamine border styles to Quadratic border styles
fn convert_excel_border_style(excel_style: calamine::BorderStyle) -> CellBorderLine {
    use calamine::BorderStyle;
    match excel_style {
        BorderStyle::None => CellBorderLine::Clear,
        BorderStyle::Thin | BorderStyle::Hair => CellBorderLine::Line1,
        BorderStyle::Medium => CellBorderLine::Line2,
        BorderStyle::Thick => CellBorderLine::Line3,
        BorderStyle::Double => CellBorderLine::Double,
        BorderStyle::Dashed | BorderStyle::MediumDashed | BorderStyle::SlantDashDot => {
            CellBorderLine::Dashed
        }
        BorderStyle::Dotted | BorderStyle::DashDotDot | BorderStyle::DashDot => {
            CellBorderLine::Dotted
        }
    }
}

/// Converts calamine border color to Quadratic color string
fn convert_excel_border_color(color: Option<&calamine::Color>) -> Rgba {
    match color {
        Some(color) => {
            // Convert calamine Color to Quadratic Rgba
            // calamine Color has alpha, red, green, blue fields
            Rgba::new(color.red, color.green, color.blue, color.alpha)
        }
        None => Rgba::default(), // Default black color
    }
}

/// Converts calamine Borders to Quadratic BorderStyleCell
fn convert_excel_borders_to_quadratic(borders: &calamine::Borders) -> BorderStyleCell {
    let convert_border = |border: &calamine::Border| -> Option<BorderStyleTimestamp> {
        let line = convert_excel_border_style(border.style);

        if line == CellBorderLine::Clear {
            return None;
        }

        Some(BorderStyleTimestamp {
            color: convert_excel_border_color(border.color.as_ref()),
            line,
            timestamp: SmallTimestamp::now(),
        })
    };

    BorderStyleCell {
        top: convert_border(&borders.top),
        bottom: convert_border(&borders.bottom),
        left: convert_border(&borders.left),
        right: convert_border(&borders.right),
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        ArraySize, CellValue, controller::user_actions::import::tests::simple_csv_at,
        number::decimal_from_str, test_util::*,
    };
    use calamine::{BorderStyle, Color};
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime, Timelike};

    #[test]
    fn test_guesses_the_csv_header() {
        let (gc, sheet_id, pos, _) = simple_csv_at(Pos { x: 1, y: 1 });
        let sheet = gc.sheet(sheet_id);
        let cell_values = sheet
            .data_table_at(&pos)
            .unwrap()
            .value_as_array()
            .unwrap()
            .clone()
            .into();
        assert!(GridController::guess_csv_first_row_is_header(&cell_values));
    }

    #[test]
    fn imports_a_simple_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = pos![A1];
        let file_name = "simple.csv";

        const SIMPLE_CSV: &str =
            "city,region,country,population\nSouthborough,MA,United States,a lot of people";

        let (ops, _) = gc
            .import_csv_operations(
                sheet_id,
                SIMPLE_CSV.as_bytes(),
                file_name,
                pos,
                Some(b','),
                Some(true),
                false,
            )
            .unwrap();

        let values = vec![
            vec!["city", "region", "country", "population"],
            vec!["Southborough", "MA", "United States", "a lot of people"],
        ];
        let context = gc.a1_context();
        let import = Import::new(sanitize_table_name(file_name.into()));
        let mut expected_data_table = DataTable::from((import, values.into(), context));
        expected_data_table.apply_first_row_as_header();

        let data_table = match ops[0].clone() {
            Operation::SetDataTable { data_table, .. } => data_table,
            _ => panic!("Expected SetDataTable operation"),
        };
        expected_data_table.last_modified = data_table.as_ref().unwrap().last_modified;
        expected_data_table.name = CellValue::Text(file_name.to_string());

        let expected = Operation::SetDataTable {
            sheet_pos: SheetPos::new(sheet_id, 1, 1),
            data_table: Some(expected_data_table),
            index: usize::MAX,
            ignore_old_data_table: true,
        };

        assert_eq!(ops.len(), 1);
        assert_eq!(ops[0], expected);
    }

    #[test]
    fn imports_a_long_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos: Pos = Pos { x: 1, y: 2 };
        let file_name = "long.csv";

        let mut csv = String::new();
        for i in 0..IMPORT_LINES_PER_OPERATION * 2 + 150 {
            csv.push_str(&format!("city{},MA,United States,{}\n", i, i * 1000));
        }

        let (ops, _) = gc
            .import_csv_operations(
                sheet_id,
                csv.as_bytes(),
                file_name,
                pos,
                Some(b','),
                Some(true),
                false,
            )
            .unwrap();

        assert_eq!(ops.len(), 1);
        let (sheet_pos, data_table) = match &ops[0] {
            Operation::SetDataTable {
                sheet_pos,
                data_table,
                ..
            } => (*sheet_pos, data_table.clone()),
            _ => panic!("Expected SetDataTable operation"),
        };
        assert_eq!(sheet_pos.x, 1);
        assert_eq!(
            data_table.as_ref().unwrap().cell_value_ref_at(0, 1),
            Some(&CellValue::Text("city0".into()))
        );
    }

    #[test]
    fn import_csv_date_time() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;

        let pos = pos![A1];
        let csv = "2024-12-21,13:23:00,2024-12-21 13:23:00\n".to_string();
        gc.import_csv(
            sheet_id,
            csv.as_bytes(),
            "csv",
            pos,
            None,
            Some(b','),
            Some(false),
            false,
            false,
        )
        .unwrap();

        print_first_sheet(&gc);

        let value = CellValue::Date(NaiveDate::parse_from_str("2024-12-21", "%Y-%m-%d").unwrap());
        assert_display_cell_value(&gc, sheet_id, 1, 1, &value.to_string());

        let value = CellValue::Time(NaiveTime::parse_from_str("13:23:00", "%H:%M:%S").unwrap());
        assert_display_cell_value(&gc, sheet_id, 2, 1, &value.to_string());

        let value = CellValue::DateTime(
            NaiveDate::from_ymd_opt(2024, 12, 21)
                .unwrap()
                .and_hms_opt(13, 23, 0)
                .unwrap(),
        );
        assert_display_cell_value(&gc, sheet_id, 3, 1, &value.to_string());
    }

    #[test]
    fn import_xlsx() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/simple.xlsx");
        gc.import_excel(file.as_ref(), "simple.xlsx", None, false)
            .unwrap();

        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet(sheet_id);

        assert_eq!(
            sheet.cell_value((1, 1).into()),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.cell_value((3, 10).into()),
            Some(CellValue::Number(12.into()))
        );
        assert_eq!(sheet.cell_value((1, 6).into()), None);
        assert_code_language(
            &gc,
            pos![sheet_id!4, 2],
            CodeCellLanguage::Formula,
            "C1:C5".into(),
        );
        assert_eq!(sheet.cell_value((4, 1).into()), None);
    }

    #[test]
    fn import_xls() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/simple.xls");
        gc.import_excel(file.as_ref(), "simple.xls", None, false)
            .unwrap();

        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet(sheet_id);

        assert_eq!(
            sheet.cell_value((1, 1).into()),
            Some(CellValue::Number(0.into()))
        );
    }

    #[test]
    fn import_excel_invalid() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/invalid.xlsx");
        let result = gc.import_excel(file.as_ref(), "invalid.xlsx", None, false);
        assert!(result.is_err());
    }

    #[test]
    fn import_parquet_date_time() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let file = include_bytes!("../../../test-files/date_time_formats_arrow.parquet");
        let pos = pos![A1];
        gc.import_parquet(
            sheet_id,
            file.to_vec(),
            "parquet",
            pos,
            None,
            None::<fn(&str, u32, u32)>,
            false,
            false,
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&pos).unwrap();

        // date
        assert_eq!(
            data_table.cell_value_at(0, 2),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-12-21", "%Y-%m-%d").unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(0, 3),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-12-22", "%Y-%m-%d").unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(0, 4),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-12-23", "%Y-%m-%d").unwrap()
            ))
        );

        // time
        assert_eq!(
            data_table.cell_value_at(1, 2),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("13:23:00", "%H:%M:%S").unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(1, 3),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("14:45:00", "%H:%M:%S").unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(1, 4),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("16:30:00", "%H:%M:%S").unwrap()
            ))
        );

        // date time
        assert_eq!(
            data_table.cell_value_at(2, 2),
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2024, 12, 21)
                    .unwrap()
                    .and_hms_opt(13, 23, 0)
                    .unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(2, 3),
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2024, 12, 22)
                    .unwrap()
                    .and_hms_opt(14, 30, 0)
                    .unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(2, 4),
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2024, 12, 23)
                    .unwrap()
                    .and_hms_opt(16, 45, 0)
                    .unwrap()
            ))
        );
    }

    #[test]
    fn import_excel_date_time() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/date_time.xlsx");
        gc.import_excel(file.as_ref(), "date_time.xlsx", None, false)
            .unwrap();

        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet(sheet_id);

        // date
        assert_eq!(
            sheet.cell_value((1, 2).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("1990-12-21", "%Y-%m-%d").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((1, 3).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("1990-12-22", "%Y-%m-%d").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((1, 4).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("1990-12-23", "%Y-%m-%d").unwrap()
            ))
        );

        // date time
        assert_eq!(
            sheet.cell_value((2, 2).into()),
            Some(CellValue::DateTime(
                NaiveDateTime::parse_from_str("2021-1-5 15:45", "%Y-%m-%d %H:%M").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((2, 3).into()),
            Some(CellValue::DateTime(
                NaiveDateTime::parse_from_str("2021-1-6 15:45", "%Y-%m-%d %H:%M").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((2, 4).into()),
            Some(CellValue::DateTime(
                NaiveDateTime::parse_from_str("2021-1-7 15:45", "%Y-%m-%d %H:%M").unwrap()
            ))
        );

        // time
        assert_eq!(
            sheet.cell_value((3, 2).into()),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("13:23:00", "%H:%M:%S").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((3, 3).into()),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("14:23:00", "%H:%M:%S").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((3, 4).into()),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("15:23:00", "%H:%M:%S").unwrap()
            ))
        );
    }

    #[test]
    fn test_import_utf16() {
        let utf16_data: Vec<u8> = vec![
            0xFF, 0xFE, // BOM
            0x68, 0x00, // h
            0x65, 0x00, // e
            0x61, 0x00, // a
            0x64, 0x00, // d
            0x65, 0x00, // e
            0x72, 0x00, // r
            0x31, 0x00, // 1
            0x2C, 0x00, // ,
            0x68, 0x00, // h
            0x65, 0x00, // e
            0x61, 0x00, // a
            0x64, 0x00, // d
            0x65, 0x00, // e
            0x72, 0x00, // r
            0x32, 0x00, // 2
            0x0A, 0x00, // \n
            0x76, 0x00, // v
            0x61, 0x00, // a
            0x6C, 0x00, // l
            0x75, 0x00, // u
            0x65, 0x00, // e
            0x31, 0x00, // 1
            0x2C, 0x00, // ,
            0x76, 0x00, // v
            0x61, 0x00, // a
            0x6C, 0x00, // l
            0x75, 0x00, // u
            0x65, 0x00, // e
            0x32, 0x00, // 2
        ];
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        gc.import_csv(
            sheet_id,
            &utf16_data,
            "utf16.csv",
            pos![A1],
            None,
            Some(b','),
            Some(true),
            false,
            false,
        )
        .unwrap();

        print_first_sheet(&gc);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value((1, 2).into()),
            Some(CellValue::Text("header1".to_string()))
        );
        assert_eq!(
            sheet.display_value((2, 2).into()),
            Some(CellValue::Text("header2".to_string()))
        );
        assert_eq!(
            sheet.display_value((1, 3).into()),
            Some(CellValue::Text("value1".to_string()))
        );
        assert_eq!(
            sheet.display_value((2, 3).into()),
            Some(CellValue::Text("value2".to_string()))
        );
    }

    #[test]
    fn import_excel_dependent_formulas() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/income_statement.xlsx");
        gc.import_excel(file.as_ref(), "income_statement.xlsx", None, false)
            .unwrap();

        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet(sheet_id);

        assert_code_language(
            &gc,
            pos![sheet_id!4, 3],
            CodeCellLanguage::Formula,
            "EOMONTH(E3,-1)".into(),
        );

        assert_eq!(
            sheet.display_value((4, 3).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-01-31", "%Y-%m-%d").unwrap()
            ))
        );

        assert_code_language(
            &gc,
            pos![sheet_id!4, 12],
            CodeCellLanguage::Formula,
            "D5-D10".into(),
        );

        assert_eq!(
            sheet.display_value((4, 12).into()),
            Some(CellValue::Number(3831163.into()))
        );

        assert_code_language(
            &gc,
            pos![sheet_id!4, 29],
            CodeCellLanguage::Formula,
            "EOMONTH(E29,-1)".into(),
        );

        assert_eq!(
            sheet.display_value((4, 29).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-01-31", "%Y-%m-%d").unwrap()
            ))
        );

        assert_code_language(
            &gc,
            pos![sheet_id!4, 67],
            CodeCellLanguage::Formula,
            "EOMONTH(E67,-1)".into(),
        );

        assert_eq!(
            sheet.display_value((4, 67).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-01-31", "%Y-%m-%d").unwrap()
            ))
        );
    }

    #[test]
    fn test_csv_error_1() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let file = include_bytes!("../../../../quadratic-rust-shared/data/csv/csv-error-1.csv");
        gc.import_csv(
            sheet_id,
            file,
            "csv-error-1.csv",
            pos![A1],
            None,
            None,
            Some(true),
            false,
            false,
        )
        .unwrap();
    }

    #[test]
    fn test_csv_error_2() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let file = include_bytes!("../../../../quadratic-rust-shared/data/csv/csv-error-2.csv");
        gc.import_csv(
            sheet_id,
            file,
            "csv-error-2.csv",
            pos![A1],
            None,
            None,
            Some(true),
            false,
            false,
        )
        .unwrap();
    }

    #[test]
    fn test_csv_width_error() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let file = include_bytes!("../../../../quadratic-rust-shared/data/csv/width_error.csv");
        gc.import_csv(
            sheet_id,
            file,
            "width_error.csv",
            pos![A1],
            None,
            None,
            Some(true),
            false,
            false,
        )
        .unwrap();
    }

    #[test]
    fn import_xlsx_styles() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/styles.xlsx");
        gc.import_excel(file.as_ref(), "styles.xlsx", None, false)
            .unwrap();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);

        assert_eq!(sheet.formats.bold.get((1, 1).into()), Some(true));
        assert_eq!(sheet.formats.italic.get((1, 2).into()), Some(true));
        assert_eq!(sheet.formats.underline.get((1, 3).into()), Some(true));
        assert_eq!(sheet.formats.strike_through.get((1, 4).into()), Some(true));
        assert_eq!(
            sheet.formats.text_color.get((1, 5).into()),
            Some("#FF0000".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get((1, 6).into()),
            Some("#FFFF00".to_string())
        );
        assert_eq!(
            sheet.formats.align.get((1, 7).into()),
            Some(CellAlign::Center)
        );
        assert_eq!(
            sheet.formats.vertical_align.get((1, 8).into()),
            Some(CellVerticalAlign::Middle)
        );
        assert_eq!(sheet.formats.wrap.get((1, 9).into()), Some(CellWrap::Wrap));
        assert_eq!(sheet.formats.bold.get((1, 10).into()), None);
        assert_eq!(sheet.formats.italic.get((1, 10).into()), None);
        assert_eq!(sheet.formats.text_color.get((1, 10).into()), None);
        assert_eq!(sheet.formats.fill_color.get((1, 10).into()), None);
        // Font sizes are stored as internal values (Excel size - FONT_SIZE_DISPLAY_ADJUSTMENT)
        // Excel 11pt (default) → not stored, Excel 14pt → 18, Excel 8pt → 12, Excel 36pt → 40
        assert_eq!(sheet.formats.font_size.get((1, 15).into()), None);
        assert_eq!(sheet.formats.font_size.get((1, 16).into()), Some(18)); // Excel 14pt
        assert_eq!(sheet.formats.font_size.get((1, 17).into()), Some(12)); // Excel 8pt
        assert_eq!(sheet.formats.font_size.get((1, 18).into()), Some(40)); // Excel 36pt
    }

    #[test]
    fn import_xlsx_named_ranges() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/named_range.xlsx");
        gc.import_excel(file.as_ref(), "named_ranges.xlsx", None, false)
            .unwrap();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);

        // formula with named range at B4
        let formula = sheet.code_run_at(&pos![B4]).unwrap();
        let expected = "SUM(Sheet1!$A$1:$B$3)".to_string();
        assert_eq!(formula.code, expected);
    }

    #[test]
    fn named_range_replacement_word_boundaries() {
        // Test the word-boundary-aware replacement logic used for named ranges
        // This ensures that named ranges that are substrings of other identifiers
        // are not incorrectly replaced

        // Build named ranges with pre-compiled regex patterns
        // Word boundaries (\b) ensure order doesn't matter - "A" won't match within "ABC"
        let named_ranges: Vec<NamedRangeReplacement> = [
            ("A", "Sheet1!$A$1"),
            ("ABC", "Sheet1!$B$2"),
            ("Total", "Sheet1!$C$3"),
            ("TotalSum", "Sheet1!$D$4"),
        ]
        .into_iter()
        .map(|(name, reference)| NamedRangeReplacement {
            name: name.to_string(),
            pattern: Regex::new(&format!(r"\b{}\b", regex::escape(name))).unwrap(),
            replacement: reference.replace('$', "$$"),
        })
        .collect();

        let test_cases = vec![
            // (input formula, expected output)
            // Named range "A" should not match "ABC"
            ("=SUM(A) + ABC", "=SUM(Sheet1!$A$1) + Sheet1!$B$2"),
            // Named range at start and end
            ("=A + A", "=Sheet1!$A$1 + Sheet1!$A$1"),
            // Named range adjacent to operators
            (
                "=A+A*A/A-A",
                "=Sheet1!$A$1+Sheet1!$A$1*Sheet1!$A$1/Sheet1!$A$1-Sheet1!$A$1",
            ),
            // "Total" should not match "TotalSum"
            ("=Total + TotalSum", "=Sheet1!$C$3 + Sheet1!$D$4"),
            // Multiple occurrences
            ("=ABC + ABC + A", "=Sheet1!$B$2 + Sheet1!$B$2 + Sheet1!$A$1"),
            // Named range in function arguments
            (
                "=SUM(A, ABC, Total)",
                "=SUM(Sheet1!$A$1, Sheet1!$B$2, Sheet1!$C$3)",
            ),
            // Named range in parentheses
            ("=(A)", "=(Sheet1!$A$1)"),
            // No named ranges to replace
            ("=1 + 2", "=1 + 2"),
        ];

        for (input, expected) in test_cases {
            let result = replace_named_ranges(input, &named_ranges);
            assert_eq!(result, expected, "Failed for input: {}", input);
        }
    }

    #[test]
    fn import_xlsx_number_format_edge_cases() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/income_statement.xlsx");
        gc.import_excel(file.as_ref(), "income_statement.xlsx", None, false)
            .unwrap();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        let to_number = |x, y| {
            if let Some(CellValue::Number(n)) = sheet.cell_value((x, y).into()) {
                n.to_f64().unwrap_or(0.0)
            } else {
                panic!("Cell {x},{y} should contain a number");
            }
        };

        let value = to_number(4, 5);
        assert!((value - 5216000.0).abs() < 0.1);

        let value = to_number(6, 8);
        assert!((value - 269414.125).abs() < 0.001);

        assert_eq!(
            sheet.cell_value((2, 3).into()),
            Some(CellValue::Text("Category".to_string()))
        );

        assert_eq!(
            sheet.cell_value((2, 7).into()),
            Some(CellValue::Text("Hosting & Platform Fees".to_string()))
        );

        assert_code_language(
            &gc,
            pos![sheet_id!4, 12],
            CodeCellLanguage::Formula,
            "D5-D10".into(),
        );

        let value = to_number(4, 14);
        assert!(value > 1_000_000.0);
        assert!(value < 10_000_000.0);

        let value = to_number(6, 16);
        assert!((value - 1363708.75).abs() < 0.01);

        let mut found_numbers = Vec::new();
        for row in 5..20 {
            for col in 4..10 {
                if let Some(CellValue::Number(n)) = sheet.cell_value((col, row).into()) {
                    found_numbers.push(n.to_f64().unwrap_or(0.0));
                }
            }
        }

        assert!(found_numbers.len() > 10);

        let max_value = found_numbers.iter().fold(0.0f64, |a, &b| a.max(b));
        let min_value = found_numbers.iter().fold(f64::INFINITY, |a, &b| a.min(b));

        assert!(max_value > 1_000_000.0, "Should have large numbers");
        assert!(min_value < 1_000_000.0, "Should have smaller numbers");

        let formula_count = (5..20)
            .flat_map(|row| (4..10).map(move |col| (col, row)))
            .filter(|(col, row)| sheet.code_run_at(&Pos { x: *col, y: *row }).is_some())
            .count();

        assert!(
            formula_count > 0,
            "Should have found some formulas in the income statement"
        );
    }

    #[test]
    fn test_excel_to_chrono_format_conversion() {
        assert_eq!(excel_to_chrono_format("mm/dd/yyyy"), "%m/%d/%Y");
        assert_eq!(excel_to_chrono_format("m/d/yy"), "%-m/%-d/%y");
        assert_eq!(excel_to_chrono_format("dd-mmm-yyyy"), "%d-%b-%Y");
        assert_eq!(excel_to_chrono_format("h:mm AM/PM"), "%-I:%M %p");
        assert_eq!(excel_to_chrono_format("hh:mm:ss"), "%H:%M:%S");
        assert_eq!(excel_to_chrono_format("mm:ss"), "%M:%S");
        assert_eq!(excel_to_chrono_format("m/d/yyyy h:mm"), "%-m/%-d/%Y %-I:%M");
        assert_eq!(
            excel_to_chrono_format("yyyy-mm-dd hh:mm:ss"),
            "%Y-%m-%d %H:%M:%S"
        );
    }

    #[test]
    fn import_excel_borders() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/borders.xlsx");
        gc.import_excel(file.as_ref(), "borders.xlsx", None, false)
            .unwrap();

        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet(sheet_id);

        let border_cell_a2 = sheet.borders.get_style_cell(pos![A2]);
        let top = border_cell_a2.top.unwrap();
        let left = border_cell_a2.left.unwrap();
        let bottom = border_cell_a2.bottom.unwrap();
        let right = border_cell_a2.right.unwrap();
        let red = Rgba::new(255, 0, 0, 255);

        assert_eq!(top.line, CellBorderLine::Line1);
        assert_eq!(top.color, red);
        assert_eq!(left.line, CellBorderLine::Line1);
        assert_eq!(left.color, red);
        assert_eq!(bottom.line, CellBorderLine::Line1);
        assert_eq!(bottom.color, red);
        assert_eq!(right.line, CellBorderLine::Line1);
        assert_eq!(right.color, red);

        let border_cell_d2 = sheet.borders.get_style_cell(pos![D2]);
        let top = border_cell_d2.top.unwrap();
        let left = border_cell_d2.left.unwrap();
        let red = Rgba::new(255, 0, 0, 255);

        assert_eq!(top.line, CellBorderLine::Dashed);
        assert_eq!(top.color, red);
        assert_eq!(left.line, CellBorderLine::Dashed);
        assert_eq!(left.color, red);
        assert!(border_cell_d2.bottom.is_none());
        assert!(border_cell_d2.right.is_none());
    }

    #[test]
    fn test_convert_excel_border_style() {
        assert_eq!(
            convert_excel_border_style(BorderStyle::None),
            CellBorderLine::Clear
        );
        assert_eq!(
            convert_excel_border_style(BorderStyle::Thin),
            CellBorderLine::Line1
        );
        assert_eq!(
            convert_excel_border_style(BorderStyle::Hair),
            CellBorderLine::Line1
        );
        assert_eq!(
            convert_excel_border_style(BorderStyle::Medium),
            CellBorderLine::Line2
        );
        assert_eq!(
            convert_excel_border_style(BorderStyle::Thick),
            CellBorderLine::Line3
        );
        assert_eq!(
            convert_excel_border_style(BorderStyle::Double),
            CellBorderLine::Double
        );
        assert_eq!(
            convert_excel_border_style(BorderStyle::DashDot),
            CellBorderLine::Dotted
        );
    }

    #[test]
    fn test_convert_excel_border_color() {
        let default_color = convert_excel_border_color(None);
        assert_eq!(default_color, Rgba::default());

        let red_color = Color::new(255, 255, 0, 0); // ARGB: fully opaque red
        let converted_color = convert_excel_border_color(Some(&red_color));
        assert_eq!(converted_color, Rgba::new(255, 0, 0, 255)); // RGBA: red with full alpha
    }

    #[test]
    fn test_convert_excel_borders_to_quadratic() {
        use calamine::{Border, BorderStyle, Borders, Color};

        // Create test borders
        let mut borders = Borders::new();
        borders.top = Border::with_color(BorderStyle::Thin, Color::rgb(255, 0, 0)); // Red thin border on top
        borders.left = Border::new(BorderStyle::Thick); // Thick border on left (no color)
        borders.bottom = Border::new(BorderStyle::Double); // Double border on bottom
        borders.right = Border::new(BorderStyle::None); // No border on right

        let quadratic_borders = convert_excel_borders_to_quadratic(&borders);

        // Verify conversions
        assert!(quadratic_borders.top.is_some());
        assert!(quadratic_borders.left.is_some());
        assert!(quadratic_borders.bottom.is_some());
        assert!(quadratic_borders.right.is_none()); // None border should be None

        let top_border = quadratic_borders.top.unwrap();
        assert_eq!(top_border.line, CellBorderLine::Line1);
        assert_eq!(top_border.color, Rgba::new(255, 0, 0, 255));

        let left_border = quadratic_borders.left.unwrap();
        assert_eq!(left_border.line, CellBorderLine::Line3);
        assert_eq!(left_border.color, Rgba::default());

        let bottom_border = quadratic_borders.bottom.unwrap();
        assert_eq!(bottom_border.line, CellBorderLine::Double);
    }

    #[test]
    fn test_import_excel_number_format() {
        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet_mut(sheet_id);
        let pos = pos![A1];
        let format_string = "\"$\"#,##0_);[Red](\"$\"#,##0)";
        let number_format = NumberFormat::new(format_string.to_string());
        import_excel_number_format(sheet, pos, &number_format);
        assert_eq!(sheet.formats.numeric_decimals.get(pos), Some(0));
        assert_eq!(sheet.formats.numeric_commas.get(pos), Some(true));
    }

    #[test]
    fn test_import_excel_number_format_string() {
        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet_mut(sheet_id);
        let pos = pos![A1];

        // test percentage format
        import_excel_number_format_string(sheet, pos, "0.00%");
        assert_eq!(
            sheet.formats.numeric_format.get(pos).unwrap().kind,
            NumericFormatKind::Percentage
        );
        assert_eq!(sheet.formats.numeric_decimals.get(pos), Some(2));

        // test currency format
        let pos2 = pos![B1];
        import_excel_number_format_string(sheet, pos2, "\"$\"#,##0.00");
        assert_eq!(
            sheet.formats.numeric_format.get(pos2).unwrap().kind,
            NumericFormatKind::Currency
        );
        assert_eq!(
            sheet.formats.numeric_format.get(pos2).unwrap().symbol,
            Some("$".to_string())
        );
        assert_eq!(sheet.formats.numeric_decimals.get(pos2), Some(2));
        assert_eq!(sheet.formats.numeric_commas.get(pos2), Some(true));

        // test scientific notation
        let pos3 = pos![C1];
        import_excel_number_format_string(sheet, pos3, "0.00E+00");
        assert_eq!(
            sheet.formats.numeric_format.get(pos3).unwrap().kind,
            NumericFormatKind::Exponential
        );
        assert_eq!(sheet.formats.numeric_decimals.get(pos3), Some(2));

        // test thousands separator without currency
        let pos4 = pos![D1];
        import_excel_number_format_string(sheet, pos4, "#,##0.000");
        assert_eq!(sheet.formats.numeric_commas.get(pos4), Some(true));
        assert_eq!(sheet.formats.numeric_decimals.get(pos4), Some(3));

        // test decimal places counting
        let pos5 = pos![E1];
        import_excel_number_format_string(sheet, pos5, "0.#####");
        assert_eq!(sheet.formats.numeric_decimals.get(pos5), Some(5));

        // test date format detection
        let pos6 = pos![F1];
        sheet.set_value(pos6, CellValue::Number(44926.into())); // Excel serial date
        import_excel_number_format_string(sheet, pos6, "yyyy-mm-dd");
        assert!(sheet.formats.date_time.get(pos6).is_some());
        // The date format should be applied but the value might not be automatically converted in this context

        // test time format detection
        let pos7 = pos![G1];
        sheet.set_value(pos7, CellValue::Number(decimal_from_str("0.5").unwrap())); // 12:00:00 in Excel time
        import_excel_number_format_string(sheet, pos7, "hh:mm:ss");
        assert!(sheet.formats.date_time.get(pos7).is_some());

        // test datetime format detection
        let pos8 = pos![H1];
        sheet.set_value(
            pos8,
            CellValue::Number(decimal_from_str("44926.5").unwrap()),
        );
        import_excel_number_format_string(sheet, pos8, "yyyy-mm-dd hh:mm:ss");
        assert!(sheet.formats.date_time.get(pos8).is_some());
    }

    #[test]
    fn test_is_excel_date_format() {
        // test various date formats
        assert!(is_excel_date_format("dd/mm/yyyy"));
        assert!(is_excel_date_format("mm/dd/yy"));
        assert!(is_excel_date_format("yyyy-mm-dd"));
        assert!(is_excel_date_format("d-mmm-yyyy"));
        assert!(is_excel_date_format("mmm"));
        assert!(is_excel_date_format("mmmm"));
        assert!(is_excel_date_format("DD/MM/YYYY")); // case insensitive

        // test non-date formats
        assert!(!is_excel_date_format("hh:mm:ss"));
        assert!(!is_excel_date_format("0.00%"));
        assert!(!is_excel_date_format("#,##0.00"));
        assert!(!is_excel_date_format("General"));
        assert!(!is_excel_date_format(""));
    }

    #[test]
    fn test_is_excel_time_format() {
        // test various time formats
        assert!(is_excel_time_format("hh:mm:ss"));
        assert!(is_excel_time_format("h:mm AM/PM"));
        assert!(is_excel_time_format("mm:ss"));
        assert!(is_excel_time_format("h:mm A/P"));
        assert!(is_excel_time_format("[h]:mm:ss"));
        assert!(is_excel_time_format("[mm]:ss"));
        assert!(is_excel_time_format("[ss]"));
        assert!(is_excel_time_format("HH:MM:SS")); // case insensitive

        // test non-time formats
        assert!(!is_excel_time_format("dd/mm/yyyy"));
        assert!(!is_excel_time_format("0.00%"));
        assert!(!is_excel_time_format("#,##0.00"));
        assert!(!is_excel_time_format("General"));
        assert!(!is_excel_time_format(""));
    }

    #[test]
    fn test_is_excel_datetime_format() {
        // test formats that are both date and time
        assert!(is_excel_datetime_format("dd/mm/yyyy hh:mm:ss"));
        assert!(is_excel_datetime_format("yyyy-mm-dd h:mm AM/PM"));
        assert!(is_excel_datetime_format("m/d/yy h:mm"));
        assert!(is_excel_datetime_format("DD/MM/YYYY HH:MM:SS")); // case insensitive

        // test formats that are only date or only time
        assert!(!is_excel_datetime_format("dd/mm/yyyy"));
        assert!(!is_excel_datetime_format("hh:mm:ss"));
        assert!(!is_excel_datetime_format("0.00%"));
        assert!(!is_excel_datetime_format(""));
    }

    #[test]
    fn test_excel_serial_to_date_time() {
        // test time conversion (fractional part only)
        let time_result = excel_serial_to_date_time(0.5, false, true, false);
        if let Some(CellValue::Time(time)) = time_result {
            assert_eq!(time.hour(), 12);
            assert_eq!(time.minute(), 0);
            assert_eq!(time.second(), 0);
        } else {
            panic!("Expected time value for 0.5");
        }

        // test quarter day (6 hours)
        let time_result = excel_serial_to_date_time(0.25, false, true, false);
        if let Some(CellValue::Time(time)) = time_result {
            assert_eq!(time.hour(), 6);
            assert_eq!(time.minute(), 0);
            assert_eq!(time.second(), 0);
        } else {
            panic!("Expected time value for 0.25");
        }

        // test date conversion (Excel serial date 1 = Dec 31, 1899 due to base date)
        let date_result = excel_serial_to_date_time(1.0, true, false, false);
        let expected_date = CellValue::Date(NaiveDate::from_ymd_opt(1899, 12, 31).unwrap());
        assert_eq!(date_result, Some(expected_date));

        // test Excel leap year bug adjustment (serial 61 = Mar 1, 1900 after adjustment)
        let date_result = excel_serial_to_date_time(61.0, true, false, false);
        let expected_date = CellValue::Date(NaiveDate::from_ymd_opt(1900, 2, 28).unwrap());
        assert_eq!(date_result, Some(expected_date));

        // test datetime conversion
        let datetime_result = excel_serial_to_date_time(1.5, false, false, true);
        let expected_datetime = CellValue::DateTime(
            NaiveDate::from_ymd_opt(1899, 12, 31)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
        );
        assert_eq!(datetime_result, Some(expected_datetime));

        // test a known date conversion (serial 2 = Jan 1, 1900)
        let date_result = excel_serial_to_date_time(2.0, true, false, false);
        let expected_date = CellValue::Date(NaiveDate::from_ymd_opt(1900, 1, 1).unwrap());
        assert_eq!(date_result, Some(expected_date));

        // test edge case: zero should return base date
        let date_result = excel_serial_to_date_time(0.0, true, false, false);
        let expected_date = CellValue::Date(NaiveDate::from_ymd_opt(1899, 12, 30).unwrap());
        assert_eq!(date_result, Some(expected_date));

        // test that time conversion handles edge cases gracefully
        // since time conversion uses fractional part (0.0-1.0), it should always be valid
        let edge_time = excel_serial_to_date_time(0.99999, false, true, false); // near midnight
        assert!(edge_time.is_some());

        // test pure time conversion works
        let time_result = excel_serial_to_date_time(0.125, false, true, false); // 3 hours
        if let Some(CellValue::Time(time)) = time_result {
            assert_eq!(time.hour(), 3);
            assert_eq!(time.minute(), 0);
            assert_eq!(time.second(), 0);
        } else {
            panic!("Expected time value for 0.125 (3 hours)");
        }
    }

    #[test]
    fn test_guess_csv_first_row_is_header_edge_cases() {
        // test with only 2 rows (should return false)
        let mut cell_values = Array::new_empty(ArraySize::new(3, 2).unwrap());
        cell_values
            .set(0, 0, CellValue::Text("Name".to_string()), false)
            .unwrap();
        cell_values
            .set(1, 0, CellValue::Text("Age".to_string()), false)
            .unwrap();
        cell_values
            .set(2, 0, CellValue::Text("City".to_string()), false)
            .unwrap();
        cell_values
            .set(0, 1, CellValue::Text("John".to_string()), false)
            .unwrap();
        cell_values
            .set(1, 1, CellValue::Number(25.into()), false)
            .unwrap();
        cell_values
            .set(2, 1, CellValue::Text("NYC".to_string()), false)
            .unwrap();

        assert!(!GridController::guess_csv_first_row_is_header(
            &cell_values.into()
        ));

        // test with blank values in first row (should return false)
        let mut cell_values = Array::new_empty(ArraySize::new(3, 3).unwrap());
        cell_values
            .set(0, 0, CellValue::Text("Name".to_string()), false)
            .unwrap();
        cell_values.set(1, 0, CellValue::Blank, false).unwrap(); // Blank header
        cell_values
            .set(2, 0, CellValue::Text("City".to_string()), false)
            .unwrap();
        cell_values
            .set(0, 1, CellValue::Text("John".to_string()), false)
            .unwrap();
        cell_values
            .set(1, 1, CellValue::Number(25.into()), false)
            .unwrap();
        cell_values
            .set(2, 1, CellValue::Text("NYC".to_string()), false)
            .unwrap();
        cell_values
            .set(0, 2, CellValue::Text("Jane".to_string()), false)
            .unwrap();
        cell_values
            .set(1, 2, CellValue::Number(30.into()), false)
            .unwrap();
        cell_values
            .set(2, 2, CellValue::Text("LA".to_string()), false)
            .unwrap();

        assert!(!GridController::guess_csv_first_row_is_header(
            &cell_values.into()
        ));

        // test case where first row is all text and subsequent rows are different types
        let mut cell_values = Array::new_empty(ArraySize::new(3, 3).unwrap());
        cell_values
            .set(0, 0, CellValue::Text("Name".to_string()), false)
            .unwrap();
        cell_values
            .set(1, 0, CellValue::Text("Age".to_string()), false)
            .unwrap();
        cell_values
            .set(2, 0, CellValue::Text("Salary".to_string()), false)
            .unwrap();
        cell_values
            .set(0, 1, CellValue::Text("John".to_string()), false)
            .unwrap();
        cell_values
            .set(1, 1, CellValue::Number(25.into()), false)
            .unwrap();
        cell_values
            .set(2, 1, CellValue::Number(50000.into()), false)
            .unwrap();
        cell_values
            .set(0, 2, CellValue::Text("Jane".to_string()), false)
            .unwrap();
        cell_values
            .set(1, 2, CellValue::Number(30.into()), false)
            .unwrap();
        cell_values
            .set(2, 2, CellValue::Number(60000.into()), false)
            .unwrap();

        assert!(GridController::guess_csv_first_row_is_header(
            &cell_values.into()
        ));

        // test case where all rows have same types (should return false)
        let mut cell_values = Array::new_empty(ArraySize::new(2, 3).unwrap());
        cell_values
            .set(0, 0, CellValue::Number(1.into()), false)
            .unwrap();
        cell_values
            .set(1, 0, CellValue::Number(2.into()), false)
            .unwrap();
        cell_values
            .set(0, 1, CellValue::Number(3.into()), false)
            .unwrap();
        cell_values
            .set(1, 1, CellValue::Number(4.into()), false)
            .unwrap();
        cell_values
            .set(0, 2, CellValue::Number(5.into()), false)
            .unwrap();
        cell_values
            .set(1, 2, CellValue::Number(6.into()), false)
            .unwrap();

        assert!(!GridController::guess_csv_first_row_is_header(
            &cell_values.into()
        ));
    }

    #[test]
    fn test_excel_to_chrono_format_edge_cases() {
        // test complex month/minute detection
        assert_eq!(excel_to_chrono_format("h:mm:ss"), "%-I:%M:%S");
        assert_eq!(excel_to_chrono_format("mm/dd/yyyy"), "%m/%d/%Y");
        assert_eq!(excel_to_chrono_format("m:ss"), "%-M:%S"); // minutes in time context
        assert_eq!(excel_to_chrono_format("m/yyyy"), "%-m/%Y"); // month in date context

        // test elapsed time formats
        assert_eq!(excel_to_chrono_format("[h]:mm:ss"), "[h]:%M:%S");
        assert_eq!(excel_to_chrono_format("[mm]:ss"), "[mm]:%S");

        // test AM/PM variations
        assert_eq!(excel_to_chrono_format("h:mm A/P"), "%-I:%M %p");
        assert_eq!(excel_to_chrono_format("h:mm AM/PM"), "%-I:%M %p");

        // test various day formats
        assert_eq!(excel_to_chrono_format("d"), "%-d");
        assert_eq!(excel_to_chrono_format("dd"), "%d");
        assert_eq!(excel_to_chrono_format("ddd"), "%a");
        assert_eq!(excel_to_chrono_format("dddd"), "%A");

        // test various month formats
        assert_eq!(excel_to_chrono_format("m"), "%-m");
        assert_eq!(excel_to_chrono_format("mm"), "%m");
        assert_eq!(excel_to_chrono_format("mmm"), "%b");
        assert_eq!(excel_to_chrono_format("mmmm"), "%B");
        assert_eq!(excel_to_chrono_format("mmmmm"), "%b"); // 5 m's should still be abbreviated

        // test hour formats
        assert_eq!(excel_to_chrono_format("h"), "%-I");
        assert_eq!(excel_to_chrono_format("hh"), "%H");

        // test second formats
        assert_eq!(excel_to_chrono_format("s"), "%-S");
        assert_eq!(excel_to_chrono_format("ss"), "%S");

        // test mixed case
        assert_eq!(excel_to_chrono_format("H:MM:SS"), "%-I:%M:%S"); // capital H should still be treated as hour

        // test time-only format detection
        assert_eq!(excel_to_chrono_format("mm:ss"), "%M:%S"); // should be minutes:seconds
        assert_eq!(excel_to_chrono_format("h:mm"), "%-I:%M"); // should be hour:minutes

        // test pass-through characters
        assert_eq!(excel_to_chrono_format("yyyy-mm-dd"), "%Y-%m-%d");
        assert_eq!(excel_to_chrono_format("dd/mm/yyyy"), "%d/%m/%Y");
        assert_eq!(excel_to_chrono_format("mm.dd.yyyy"), "%m.%d.%Y");
    }
}
