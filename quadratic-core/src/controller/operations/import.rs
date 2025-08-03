use std::{io::Cursor, path::Path};

use anyhow::{Result, anyhow, bail};
use chrono::{NaiveDate, NaiveTime};

use crate::{
    Array, CellValue, Pos, SheetPos,
    cell_values::CellValues,
    cellvalue::Import,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        execution::TransactionSource,
    },
    grid::{
        CodeCellLanguage, CodeCellValue, DataTable, SheetId, fix_names::sanitize_table_name,
        formats::SheetFormatUpdates, unique_data_table_name,
    },
    parquet::parquet_to_array,
};
use calamine::{
    Data as ExcelData, Error as CalamineError, Reader as ExcelReader, Sheets, open_workbook_from_rs,
};

use super::{
    csv::{clean_csv_file, find_csv_info},
    operation::Operation,
};

const IMPORT_LINES_PER_OPERATION: u32 = 10000;

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

    /// Imports a CSV file into the grid.
    pub fn import_csv_operations(
        &mut self,
        sheet_id: SheetId,
        file: &[u8],
        file_name: &str,
        insert_at: Pos,
        delimiter: Option<u8>,
        create_table: Option<bool>,
    ) -> Result<Vec<Operation>> {
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
                        let (cell_value, format_update) = self.string_to_cell_value(value, false);

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

        let apply_first_row_as_header = match create_table {
            Some(true) => true,
            Some(false) => false,
            None => GridController::guess_csv_first_row_is_header(&cell_values),
        };

        if is_table && apply_first_row_as_header {
            let cell_values: Array = cell_values.into();

            let import = Import::new(sanitize_table_name(file_name.into()));
            let mut data_table = DataTable::from((
                import.to_owned(),
                Array::new_empty(cell_values.size()),
                self.a1_context(),
            ));
            data_table.value = cell_values.into();

            if !sheet_format_updates.is_default() {
                data_table
                    .formats
                    .get_or_insert_default()
                    .apply_updates(&sheet_format_updates);
            }

            data_table.apply_first_row_as_header();
            ops.push(Operation::AddDataTable {
                sheet_pos,
                data_table,
                cell_value: CellValue::Import(import),
                index: None,
            });
            drop(sheet_format_updates);
        } else {
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

        Ok(ops)
    }

    /// Imports an Excel file into the grid.
    pub fn import_excel_operations(
        &mut self,
        file: &[u8],
        file_name: &str,
    ) -> Result<Vec<Operation>> {
        let mut ops: Vec<Operation> = vec![];
        let error = |e: CalamineError| anyhow!("Error parsing Excel file {file_name}: {e}");

        // detect file extension
        let path = Path::new(file_name);
        let cursor = Cursor::new(file);
        let mut workbook = match path.extension().and_then(|e| e.to_str()) {
            Some("xls") | Some("xla") => {
                Sheets::Xls(open_workbook_from_rs(cursor).map_err(CalamineError::Xls)?)
            }
            Some("xlsx") | Some("xlsm") | Some("xlam") => {
                Sheets::Xlsx(open_workbook_from_rs(cursor).map_err(CalamineError::Xlsx)?)
            }
            Some("xlsb") => {
                Sheets::Xlsb(open_workbook_from_rs(cursor).map_err(CalamineError::Xlsb)?)
            }
            Some("ods") => Sheets::Ods(open_workbook_from_rs(cursor).map_err(CalamineError::Ods)?),
            _ => return Err(anyhow!("Cannot detect file format")),
        };

        let sheets = workbook.sheet_names().to_owned();

        for new_sheet_name in sheets.iter() {
            if self.try_sheet_from_name(new_sheet_name).is_some() {
                bail!("Sheet with name \"{new_sheet_name}\" already exists");
            }
        }

        let xlsx_range_to_pos = |(row, col)| Pos {
            x: col as i64 + 1,
            y: row as i64 + 1,
        };

        // total rows for calculating import progress
        let total_rows = sheets
            .iter()
            .try_fold(0, |acc, sheet_name| {
                let range = workbook.worksheet_range(sheet_name)?;
                // counted twice because we have to read values and formulas
                Ok(acc + 2 * range.rows().count())
            })
            .map_err(error)?;
        let mut current_y_values = 0;
        let mut current_y_formula = 0;

        let mut gc = GridController::new_blank();

        // add all sheets to the grid, this is required for sheet name parsing in cell ref
        for sheet_name in sheets.iter() {
            gc.server_add_sheet_with_name(sheet_name.to_owned());
        }

        let formula_start_name = unique_data_table_name("Formula1", false, None, self.a1_context());

        // add data from excel file to grid
        for sheet_name in sheets {
            let sheet = gc
                .try_sheet_from_name(&sheet_name)
                .ok_or(anyhow!("Error parsing Excel file {file_name}"))?;
            let sheet_id = sheet.id;

            // values
            let range = workbook.worksheet_range(&sheet_name).map_err(error)?;
            let insert_at = range.start().map_or_else(|| pos![A1], xlsx_range_to_pos);
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
                        x: insert_at.x + x as i64,
                        y: insert_at.y + y as i64,
                    };
                    let sheet = gc
                        .try_sheet_mut(sheet_id)
                        .ok_or(anyhow!("Error parsing Excel file {file_name}"))?;
                    sheet.columns.set_value(&pos, cell_value);
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
            let formula = workbook.worksheet_formula(&sheet_name).map_err(error)?;
            let insert_at = formula.start().map_or_else(Pos::default, xlsx_range_to_pos);
            for (y, row) in formula.rows().enumerate() {
                for (x, cell) in row.iter().enumerate() {
                    if !cell.is_empty() {
                        let pos = Pos {
                            x: insert_at.x + x as i64,
                            y: insert_at.y + y as i64,
                        };
                        let sheet_pos = pos.to_sheet_pos(sheet_id);
                        let cell_value = CellValue::Code(CodeCellValue {
                            language: CodeCellLanguage::Formula,
                            code: cell.to_string(),
                        });
                        let sheet = gc
                            .try_sheet_mut(sheet_id)
                            .ok_or(anyhow!("Error parsing Excel file {file_name}"))?;
                        sheet.columns.set_value(&pos, cell_value);
                        let mut transaction = PendingTransaction {
                            source: TransactionSource::Server,
                            ..Default::default()
                        };
                        gc.add_formula_without_eval(
                            &mut transaction,
                            sheet_pos,
                            cell,
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
        }

        // rerun all formulas in-order
        let compute_ops = gc.rerun_all_code_cells_operations();
        gc.server_apply_transaction(compute_ops, None);

        for sheet in gc.grid.sheets.into_values() {
            ops.push(Operation::AddSheet {
                sheet: Box::new(sheet),
            });
        }

        Ok(ops)
    }

    /// Imports a Parquet file into the grid.
    pub fn import_parquet_operations(
        &mut self,
        sheet_id: SheetId,
        file: Vec<u8>,
        file_name: &str,
        insert_at: Pos,
        updater: Option<impl Fn(&str, u32, u32)>,
    ) -> Result<Vec<Operation>> {
        let cell_values = parquet_to_array(file, file_name, updater)?;
        let context = self.a1_context();
        let import = Import::new(sanitize_table_name(file_name.into()));
        let mut data_table = DataTable::from((import.to_owned(), cell_values, context));
        data_table.apply_first_row_as_header();

        let ops = vec![Operation::AddDataTable {
            sheet_pos: SheetPos::from((insert_at, sheet_id)),
            data_table,
            cell_value: CellValue::Import(import),
            index: None,
        }];

        Ok(ops)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{CellValue, controller::user_actions::import::tests::simple_csv_at, test_util::*};
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};

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

        let ops = gc
            .import_csv_operations(
                sheet_id,
                SIMPLE_CSV.as_bytes(),
                file_name,
                pos,
                Some(b','),
                Some(true),
            )
            .unwrap();

        let values = vec![
            vec!["city", "region", "country", "population"],
            vec!["Southborough", "MA", "United States", "a lot of people"],
        ];
        let context = gc.a1_context();
        let import = Import::new(sanitize_table_name(file_name.into()));
        let cell_value = CellValue::Import(import.clone());
        let mut expected_data_table = DataTable::from((import, values.into(), context));
        expected_data_table.apply_first_row_as_header();

        let data_table = match ops[0].clone() {
            Operation::AddDataTable { data_table, .. } => data_table,
            _ => panic!("Expected AddDataTable operation"),
        };
        expected_data_table.last_modified = data_table.last_modified;
        expected_data_table.name = CellValue::Text(file_name.to_string());

        let expected = Operation::AddDataTable {
            sheet_pos: SheetPos::new(sheet_id, 1, 1),
            data_table: expected_data_table,
            cell_value,
            index: None,
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

        let ops = gc
            .import_csv_operations(
                sheet_id,
                csv.as_bytes(),
                file_name,
                pos,
                Some(b','),
                Some(true),
            )
            .unwrap();

        assert_eq!(ops.len(), 1);
        let (sheet_pos, data_table) = match &ops[0] {
            Operation::AddDataTable {
                sheet_pos,
                data_table,
                ..
            } => (*sheet_pos, data_table.clone()),
            _ => panic!("Expected AddDataTable operation"),
        };
        assert_eq!(sheet_pos.x, 1);
        assert_eq!(
            data_table.cell_value_ref_at(0, 1),
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
        gc.import_excel(file.as_ref(), "simple.xlsx", None).unwrap();

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
        assert_eq!(
            sheet.cell_value((4, 2).into()),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "C1:C5".into()
            }))
        );
        assert_eq!(sheet.cell_value((4, 1).into()), None);
    }

    #[test]
    fn import_xls() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/simple.xls");
        gc.import_excel(file.as_ref(), "simple.xls", None).unwrap();

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
        let result = gc.import_excel(file.as_ref(), "invalid.xlsx", None);
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
        gc.import_excel(file.as_ref(), "date_time.xlsx", None)
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
        gc.import_excel(file.as_ref(), "income_statement.xlsx", None)
            .unwrap();

        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet(sheet_id);

        assert_eq!(
            sheet.cell_value((4, 3).into()),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "EOMONTH(E3,-1)".into()
            }))
        );
        assert_eq!(
            sheet.display_value((4, 3).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-01-31", "%Y-%m-%d").unwrap()
            ))
        );

        assert_eq!(
            sheet.cell_value((4, 12).into()),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "D5-D10".into()
            }))
        );
        assert_eq!(
            sheet.display_value((4, 12).into()),
            Some(CellValue::Number(3831163.into()))
        );

        assert_eq!(
            sheet.cell_value((4, 29).into()),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "EOMONTH(E29,-1)".into()
            }))
        );
        assert_eq!(
            sheet.display_value((4, 29).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-01-31", "%Y-%m-%d").unwrap()
            ))
        );

        assert_eq!(
            sheet.cell_value((4, 67).into()),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "EOMONTH(E67,-1)".into()
            }))
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
        )
        .unwrap();
    }
}
