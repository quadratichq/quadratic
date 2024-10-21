use std::{borrow::Cow, io::Cursor};

use anyhow::{anyhow, bail, Result};
use chrono::{NaiveDate, NaiveTime};

use crate::{
    arrow::arrow_col_to_cell_value_vec,
    cell_values::CellValues,
    cellvalue::Import,
    controller::GridController,
    grid::{file::sheet_schema::export_sheet, CodeCellLanguage, DataTable, Sheet, SheetId},
    Array, ArraySize, CellValue, CodeCellValue, Pos, SheetPos,
};
use bytes::Bytes;
use calamine::{Data as ExcelData, Reader as ExcelReader, Xlsx, XlsxError};
use lexicon_fractional_index::key_between;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

use super::operation::Operation;

const IMPORT_LINES_PER_OPERATION: u32 = 10000;

impl GridController {
    /// Imports a CSV file into the grid.
    pub fn import_csv_operations(
        &mut self,
        sheet_id: SheetId,
        file: Vec<u8>,
        file_name: &str,
        insert_at: Pos,
    ) -> Result<Vec<Operation>> {
        let error = |message: String| anyhow!("Error parsing CSV file {}: {}", file_name, message);
        let import = Import::new(file_name.into());
        let file: &[u8] = match String::from_utf8_lossy(&file) {
            Cow::Borrowed(_) => &file,
            Cow::Owned(_) => {
                if let Some(utf) = read_utf16(&file) {
                    return self.import_csv_operations(
                        sheet_id,
                        utf.as_bytes().to_vec(),
                        file_name,
                        insert_at,
                    );
                }
                &file
            }
        };
        let reader = |flexible| {
            csv::ReaderBuilder::new()
                .has_headers(false)
                .flexible(flexible)
                .from_reader(file)
        };

        // first get the total number of lines so we can provide progress
        let height = reader(false).records().count() as u32;

        // since the first row or more can be headers, look at the width of the last row
        let width = reader(true)
            .records()
            .last()
            .iter()
            .flatten()
            .next()
            .map(|s| s.len())
            .unwrap_or(0) as u32;

        if width == 0 {
            bail!("empty files cannot be processed");
        }

        let mut ops = vec![] as Vec<Operation>;
        let array_size = ArraySize::new_or_err(width, height).map_err(|e| error(e.to_string()))?;
        let mut cell_values = Array::new_empty(array_size);
        let mut y: u32 = 0;

        for entry in reader(true).records() {
            match entry {
                Err(e) => return Err(error(format!("line {}: {}", y + 1, e))),
                Ok(record) => {
                    for (x, value) in record.iter().enumerate() {
                        let (operations, cell_value) = self.string_to_cell_value(
                            SheetPos {
                                x: insert_at.x + x as i64,
                                y: insert_at.y + y as i64,
                                sheet_id,
                            },
                            value,
                        );
                        ops.extend(operations);
                        cell_values
                            .set(x as u32, y, cell_value)
                            .map_err(|e| error(e.to_string()))?;
                    }
                }
            }

            y += 1;

            // update the progress bar every time there's a new batch
            let should_update = y % IMPORT_LINES_PER_OPERATION == 0;

            if should_update && (cfg!(target_family = "wasm") || cfg!(test)) {
                crate::wasm_bindings::js::jsImportProgress(
                    file_name,
                    y,
                    height,
                    insert_at.x,
                    insert_at.y,
                    width,
                    height,
                );
            }
        }

        // finally add the final operation
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| anyhow!("Sheet {sheet_id} not found"))?;
        let mut data_table = DataTable::from((import.to_owned(), cell_values, sheet));
        data_table.name = file_name.to_string();
        let sheet_pos = SheetPos::from((insert_at, sheet_id));

        // this operation must be before the SetCodeRun operations
        ops.push(Operation::SetCellValues {
            sheet_pos,
            values: CellValues::from(CellValue::Import(import)),
        });

        ops.push(Operation::SetCodeRun {
            sheet_pos: SheetPos {
                x: insert_at.x,
                y: insert_at.y,
                sheet_id,
            },
            code_run: Some(data_table),
            index: y as usize,
        });

        Ok(ops)
    }

    /// Imports an Excel file into the grid.
    pub fn import_excel_operations(
        &mut self,
        file: Vec<u8>,
        file_name: &str,
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![] as Vec<Operation>;
        let error = |e: XlsxError| anyhow!("Error parsing Excel file {file_name}: {e}");

        let cursor = Cursor::new(file);
        let mut workbook: Xlsx<_> = ExcelReader::new(cursor).map_err(error)?;
        let sheets = workbook.sheet_names().to_owned();

        let existing_sheet_names = self.sheet_names();
        for sheet_name in sheets.iter() {
            if existing_sheet_names.contains(&sheet_name.as_str()) {
                bail!("Sheet with name {} already exists", sheet_name);
            }
        }
        // first cell in excel is A1, but first cell in quadratic is A0
        // so we need to offset rows by 1, so that values are inserted in the original A1 notations cell
        // this is required so that cell references (A1 notations) in formulas are correct
        let xlsx_range_to_pos = |(row, col)| Pos {
            x: col as i64,
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

        let mut order = key_between(&None, &None).unwrap_or("A0".to_string());
        for sheet_name in sheets {
            // add the sheet
            let mut sheet = Sheet::new(SheetId::new(), sheet_name.to_owned(), order.clone());
            order = key_between(&Some(order), &None).unwrap_or("A0".to_string());

            // values
            let range = workbook.worksheet_range(&sheet_name).map_err(error)?;
            let insert_at = range.start().map_or_else(Pos::default, xlsx_range_to_pos);
            for (y, row) in range.rows().enumerate() {
                for (x, cell) in row.iter().enumerate() {
                    let cell_value = match cell {
                        ExcelData::Empty => continue,
                        ExcelData::String(value) => CellValue::Text(value.to_string()),
                        ExcelData::DateTimeIso(ref value) => CellValue::unpack_date_time(value)
                            .unwrap_or(CellValue::Text(value.to_string())),
                        ExcelData::DateTime(ref value) => {
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
                        ExcelData::DurationIso(ref value) => CellValue::Text(value.to_string()),
                        ExcelData::Float(ref value) => {
                            CellValue::unpack_str_float(&value.to_string(), CellValue::Blank)
                        }
                        ExcelData::Int(ref value) => {
                            CellValue::unpack_str_float(&value.to_string(), CellValue::Blank)
                        }
                        ExcelData::Error(_) => continue,
                        ExcelData::Bool(value) => CellValue::Logical(*value),
                    };

                    sheet.set_cell_value(
                        Pos {
                            x: insert_at.x + x as i64,
                            y: insert_at.y + y as i64,
                        },
                        cell_value,
                    );
                }

                // send progress to the client, every IMPORT_LINES_PER_OPERATION
                if (cfg!(target_family = "wasm") || cfg!(test))
                    && current_y_values % IMPORT_LINES_PER_OPERATION == 0
                {
                    let width = row.len() as u32;
                    crate::wasm_bindings::js::jsImportProgress(
                        file_name,
                        current_y_values + current_y_formula,
                        total_rows as u32,
                        0,
                        1,
                        width,
                        total_rows as u32,
                    );
                }
                current_y_values += 1;
            }

            // formulas
            let formula = workbook.worksheet_formula(&sheet_name).map_err(error)?;
            let insert_at = formula.start().map_or_else(Pos::default, xlsx_range_to_pos);
            let mut formula_compute_ops = vec![];
            for (y, row) in formula.rows().enumerate() {
                for (x, cell) in row.iter().enumerate() {
                    if !cell.is_empty() {
                        let pos = Pos {
                            x: insert_at.x + x as i64,
                            y: insert_at.y + y as i64,
                        };
                        let cell_value = CellValue::Code(CodeCellValue {
                            language: CodeCellLanguage::Formula,
                            code: cell.to_string(),
                        });
                        sheet.set_cell_value(pos, cell_value);
                        // add code compute operation, to generate code runs
                        formula_compute_ops.push(Operation::ComputeCode {
                            sheet_pos: pos.to_sheet_pos(sheet.id),
                        });
                    }
                }

                // send progress to the client, every IMPORT_LINES_PER_OPERATION
                if (cfg!(target_family = "wasm") || cfg!(test))
                    && current_y_formula % IMPORT_LINES_PER_OPERATION == 0
                {
                    let width = row.len() as u32;
                    crate::wasm_bindings::js::jsImportProgress(
                        file_name,
                        current_y_values + current_y_formula,
                        total_rows as u32,
                        0,
                        1,
                        width,
                        total_rows as u32,
                    );
                }
                current_y_formula += 1;
            }
            // add new sheets
            ops.push(Operation::AddSheetSchema {
                schema: export_sheet(sheet),
            });
            ops.extend(formula_compute_ops);
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
    ) -> Result<Vec<Operation>> {
        let mut ops = vec![] as Vec<Operation>;
        let import = Import::new(file_name.into());
        let error =
            |message: String| anyhow!("Error parsing Parquet file {}: {}", file_name, message);

        // this is not expensive
        let bytes = Bytes::from(file);
        let builder = ParquetRecordBatchReaderBuilder::try_new(bytes)?;

        // headers
        let metadata = builder.metadata();
        let total_size = metadata.file_metadata().num_rows() as u32;
        let fields = metadata.file_metadata().schema().get_fields();
        let headers: Vec<CellValue> = fields.iter().map(|f| f.name().into()).collect();
        let mut width = headers.len() as u32;

        // add 1 to the height for the headers
        let array_size =
            ArraySize::new_or_err(width, total_size + 1).map_err(|e| error(e.to_string()))?;
        let mut cell_values = Array::new_empty(array_size);

        // add the headers to the first row
        for (x, header) in headers.into_iter().enumerate() {
            cell_values
                .set(x as u32, 0, header)
                .map_err(|e| error(e.to_string()))?
        }

        let reader = builder.build()?;
        let mut height = 0;
        let mut current_size = 0;

        for (row_index, batch) in reader.enumerate() {
            let batch = batch?;
            let num_rows = batch.num_rows();
            let num_cols = batch.num_columns();

            current_size += num_rows;
            width = width.max(num_cols as u32);
            height = height.max(num_rows as u32);

            for col_index in 0..num_cols {
                let col = batch.column(col_index);
                let values = arrow_col_to_cell_value_vec(col)?;
                let x = col_index as u32;
                let y = (row_index * num_rows) as u32 + 1;

                for (index, value) in values.into_iter().enumerate() {
                    cell_values
                        .set(x, y + index as u32, value)
                        .map_err(|e| error(e.to_string()))?;
                }

                // update the progress bar every time there's a new operation
                if cfg!(target_family = "wasm") || cfg!(test) {
                    crate::wasm_bindings::js::jsImportProgress(
                        file_name,
                        current_size as u32,
                        total_size,
                        insert_at.x,
                        insert_at.y,
                        width,
                        height,
                    );
                }
            }
        }
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| anyhow!("Sheet {sheet_id} not found"))?;
        let sheet_pos = SheetPos::from((insert_at, sheet_id));
        let mut data_table = DataTable::from((import.to_owned(), cell_values, sheet));
        data_table.apply_first_row_as_header();

        // this operation must be before the SetCodeRun operations
        ops.push(Operation::SetCellValues {
            sheet_pos,
            values: CellValues::from(CellValue::Import(import)),
        });

        ops.push(Operation::SetCodeRun {
            sheet_pos,
            code_run: Some(data_table),
            index: 0,
        });

        Ok(ops)
    }
}

fn read_utf16(bytes: &[u8]) -> Option<String> {
    if bytes.is_empty() && bytes.len() % 2 == 0 {
        return None;
    }

    // convert u8 to u16
    let mut utf16vec: Vec<u16> = Vec::with_capacity(bytes.len() / 2);
    for chunk in bytes.to_owned().chunks_exact(2) {
        let Ok(vec2) = <[u8; 2]>::try_from(chunk) else {
            return None;
        };
        utf16vec.push(u16::from_ne_bytes(vec2));
    }

    // convert to string
    let Ok(str) = String::from_utf16(utf16vec.as_slice()) else {
        return None;
    };

    // strip invalid characters
    let result: String = str.chars().filter(|&c| c.len_utf8() <= 2).collect();

    Some(result)
}

#[cfg(test)]
mod test {
    use super::{read_utf16, *};
    use crate::{
        test_util::{assert_data_table_cell_value, assert_display_cell_value},
        CellValue,
    };
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
    use serial_test::parallel;

    const INVALID_ENCODING_FILE: &[u8] =
        include_bytes!("../../../../quadratic-rust-shared/data/csv/encoding_issue.csv");

    #[test]
    #[parallel]
    fn transmute_u8_to_u16() {
        let result = read_utf16(INVALID_ENCODING_FILE).unwrap();
        assert_eq!("issue, test, value\r\n0, 1, Invalid\r\n0, 2, Valid", result);
    }

    #[test]
    #[parallel]
    fn imports_a_simple_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let file_name = "simple.csv";

        const SIMPLE_CSV: &str =
            "city,region,country,population\nSouthborough,MA,United States,a lot of people";

        let ops = gc
            .import_csv_operations(sheet_id, SIMPLE_CSV.as_bytes().to_vec(), file_name, pos)
            .unwrap();

        let values = vec![
            vec!["city", "region", "country", "population"],
            vec!["Southborough", "MA", "United States", "a lot of people"],
        ];
        let import = Import::new(file_name.into());
        let cell_value = CellValue::Import(import.clone());
        let sheet = gc.try_sheet(sheet_id).unwrap();
        let mut expected_data_table = DataTable::from((import, values.into(), sheet));
        assert_display_cell_value(&gc, sheet_id, 0, 0, &cell_value.to_string());

        let data_table = match ops[1].clone() {
            Operation::SetCodeRun { code_run, .. } => code_run.unwrap(),
            _ => panic!("Expected SetCodeRun operation"),
        };
        expected_data_table.last_modified = data_table.last_modified;
        expected_data_table.name = file_name.to_string();
        
        let expected = Operation::SetCodeRun {
            sheet_pos: SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            code_run: Some(expected_data_table),
            index: 2,
        };

        assert_eq!(ops.len(), 2);
        assert_eq!(ops[1], expected);
    }

    #[test]
    #[parallel]
    fn imports_a_long_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 1, y: 2 };
        let file_name = "long.csv";

        let mut csv = String::new();
        for i in 0..IMPORT_LINES_PER_OPERATION * 2 + 150 {
            csv.push_str(&format!("city{},MA,United States,{}\n", i, i * 1000));
        }

        let ops = gc.import_csv_operations(sheet_id, csv.as_bytes().to_vec(), file_name, pos);

        let import = Import::new(file_name.into());
        let cell_value = CellValue::Import(import.clone());
        assert_display_cell_value(&gc, sheet_id, 0, 0, &cell_value.to_string());

        assert_eq!(ops.as_ref().unwrap().len(), 2);

        let (sheet_pos, data_table) = match &ops.unwrap()[1] {
            Operation::SetCodeRun {
                sheet_pos,
                code_run,
                ..
            } => (sheet_pos.clone(), code_run.clone().unwrap()),
            _ => panic!("Expected SetCodeRun operation"),
        };
        assert_eq!(sheet_pos.x, 1);
        assert_eq!(
            data_table.cell_value_ref_at(0, 1),
            Some(&CellValue::Text("city0".into()))
        );
    }

    #[test]
    #[parallel]
    fn import_csv_date_time() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;

        let pos = Pos { x: 0, y: 0 };
        let csv = "2024-12-21,13:23:00,2024-12-21 13:23:00\n".to_string();
        gc.import_csv(sheet_id, csv.as_bytes().to_vec(), "csv", pos, None)
            .unwrap();

        let value = CellValue::Date(NaiveDate::parse_from_str("2024-12-21", "%Y-%m-%d").unwrap());
        assert_data_table_cell_value(&gc, sheet_id, 0, 0, &value.to_string());

        let value = CellValue::Time(NaiveTime::parse_from_str("13:23:00", "%H:%M:%S").unwrap());
        assert_data_table_cell_value(&gc, sheet_id, 1, 0, &value.to_string());

        let value = CellValue::DateTime(
            NaiveDate::from_ymd_opt(2024, 12, 21)
                .unwrap()
                .and_hms_opt(13, 23, 0)
                .unwrap(),
        );
        assert_data_table_cell_value(&gc, sheet_id, 2, 0, &value.to_string());
    }

    #[test]
    #[parallel]
    fn import_excel() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/simple.xlsx");
        gc.import_excel(file.to_vec(), "simple.xlsx", None).unwrap();

        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet(sheet_id);

        assert_eq!(
            sheet.cell_value((0, 1).into()),
            Some(CellValue::Number(1.into()))
        );
        assert_eq!(
            sheet.cell_value((2, 10).into()),
            Some(CellValue::Number(12.into()))
        );
        assert_eq!(sheet.cell_value((0, 6).into()), None);
        assert_eq!(
            sheet.cell_value((3, 2).into()),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "C1:C5".into()
            }))
        );
        assert_eq!(sheet.cell_value((3, 1).into()), None);
    }

    #[test]
    #[parallel]
    fn import_excel_invalid() {
        let mut gc = GridController::new_blank();
        let file = include_bytes!("../../../test-files/invalid.xlsx");
        let result = gc.import_excel(file.to_vec(), "invalid.xlsx", None);
        assert!(result.is_err());
    }

    #[test]
    #[parallel]
    fn import_parquet_date_time() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let file = include_bytes!("../../../test-files/date_time_formats_arrow.parquet");
        let pos = Pos { x: 0, y: 0 };
        gc.import_parquet(sheet_id, file.to_vec(), "parquet", pos, None)
            .unwrap();

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();

        // date
        assert_eq!(
            data_table.cell_value_at(0, 1),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-12-21", "%Y-%m-%d").unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(0, 2),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-12-22", "%Y-%m-%d").unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(0, 3),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("2024-12-23", "%Y-%m-%d").unwrap()
            ))
        );

        // time
        assert_eq!(
            data_table.cell_value_at(1, 1),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("13:23:00", "%H:%M:%S").unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(1, 2),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("14:45:00", "%H:%M:%S").unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(1, 3),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("16:30:00", "%H:%M:%S").unwrap()
            ))
        );

        // date time
        assert_eq!(
            data_table.cell_value_at(2, 1),
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2024, 12, 21)
                    .unwrap()
                    .and_hms_opt(13, 23, 0)
                    .unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(2, 2),
            Some(CellValue::DateTime(
                NaiveDate::from_ymd_opt(2024, 12, 22)
                    .unwrap()
                    .and_hms_opt(14, 30, 0)
                    .unwrap()
            ))
        );
        assert_eq!(
            data_table.cell_value_at(2, 3),
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
        gc.import_excel(file.to_vec(), "excel", None).unwrap();

        let sheet_id = gc.grid.sheets()[0].id;
        let sheet = gc.sheet(sheet_id);

        // date
        assert_eq!(
            sheet.cell_value((0, 2).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("1990-12-21", "%Y-%m-%d").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((0, 3).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("1990-12-22", "%Y-%m-%d").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((0, 4).into()),
            Some(CellValue::Date(
                NaiveDate::parse_from_str("1990-12-23", "%Y-%m-%d").unwrap()
            ))
        );

        // date time
        assert_eq!(
            sheet.cell_value((1, 2).into()),
            Some(CellValue::DateTime(
                NaiveDateTime::parse_from_str("2021-1-5 15:45", "%Y-%m-%d %H:%M").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((1, 3).into()),
            Some(CellValue::DateTime(
                NaiveDateTime::parse_from_str("2021-1-6 15:45", "%Y-%m-%d %H:%M").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((1, 4).into()),
            Some(CellValue::DateTime(
                NaiveDateTime::parse_from_str("2021-1-7 15:45", "%Y-%m-%d %H:%M").unwrap()
            ))
        );

        // time
        assert_eq!(
            sheet.cell_value((2, 2).into()),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("13:23:00", "%H:%M:%S").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((2, 3).into()),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("14:23:00", "%H:%M:%S").unwrap()
            ))
        );
        assert_eq!(
            sheet.cell_value((2, 4).into()),
            Some(CellValue::Time(
                NaiveTime::parse_from_str("15:23:00", "%H:%M:%S").unwrap()
            ))
        );
    }
}
