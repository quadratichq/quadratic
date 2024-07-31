use std::io::Cursor;

use anyhow::{anyhow, bail, Result};
use lexicon_fractional_index::key_between;

use crate::{
    cell_values::CellValues,
    controller::GridController,
    grid::{file::sheet_schema::export_sheet, CodeCellLanguage, Sheet, SheetId},
    CellValue, CodeCellValue, Pos, SheetPos,
};
use bytes::Bytes;
use calamine::{Data as ExcelData, Reader as ExcelReader, Xlsx, XlsxError};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

use super::operation::Operation;

const IMPORT_LINES_PER_OPERATION: u32 = 10000;

impl GridController {
    /// Imports a CSV file into the grid.
    pub fn import_csv_operations(
        &mut self,
        sheet_id: SheetId,
        file: &[u8],
        file_name: &str,
        insert_at: Pos,
    ) -> Result<Vec<Operation>> {
        let error = |message: String| anyhow!("Error parsing CSV file {}: {}", file_name, message);
        let file = match String::from_utf8_lossy(file) {
            std::borrow::Cow::Borrowed(_) => file,
            std::borrow::Cow::Owned(_) => {
                if let Some(utf) = read_utf16(file) {
                    return self.import_csv_operations(
                        sheet_id,
                        utf.as_bytes(),
                        file_name,
                        insert_at,
                    );
                }
                file
            }
        };

        // first get the total number of lines so we can provide progress
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(file);
        let height = reader.records().count() as u32;

        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .flexible(true)
            .from_reader(file);

        let width = reader.headers()?.len() as u32;
        if width == 0 {
            bail!("empty files cannot be processed");
        }

        // then create operations using MAXIMUM_IMPORT_LINES to break up the SetCellValues operations
        let mut ops = vec![] as Vec<Operation>;
        let mut cell_values = CellValues::new(width, height);
        let mut current_y = 0;
        let mut y: u32 = 0;
        for entry in reader.records() {
            match entry {
                Err(e) => return Err(error(format!("line {}: {}", current_y + y + 1, e))),
                Ok(record) => {
                    for (x, value) in record.iter().enumerate() {
                        let (operations, cell_value) = self.string_to_cell_value(
                            SheetPos {
                                x: insert_at.x + x as i64,
                                y: insert_at.y + current_y as i64 + y as i64,
                                sheet_id,
                            },
                            value,
                        );
                        ops.extend(operations);
                        cell_values.set(x as u32, y, cell_value);
                    }
                }
            }
            y += 1;
            if y >= IMPORT_LINES_PER_OPERATION {
                ops.push(Operation::SetCellValues {
                    sheet_pos: SheetPos {
                        x: insert_at.x,
                        y: insert_at.y + current_y as i64,
                        sheet_id,
                    },
                    values: cell_values,
                });
                current_y += y;
                y = 0;
                let h = (height - current_y).min(IMPORT_LINES_PER_OPERATION);
                cell_values = CellValues::new(width, h);

                // update the progress bar every time there's a new operation
                if cfg!(target_family = "wasm") {
                    crate::wasm_bindings::js::jsImportProgress(
                        file_name,
                        current_y,
                        height,
                        insert_at.x,
                        insert_at.y,
                        width,
                        height,
                    );
                }
            }
        }

        // finally add the final operation
        ops.push(Operation::SetCellValues {
            sheet_pos: SheetPos {
                x: insert_at.x,
                y: insert_at.y + current_y as i64,
                sheet_id,
            },
            values: cell_values,
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

        // first cell in excel is A1, but first cell in quadratic is A0
        // so we need to offset rows by 1, so that values are inserted in the original A1 notations cell
        // this is required so that cell references (A1 notations) in formulas are correct
        let xlsx_range_to_pos = |(row, col)| Pos {
            x: col as i64,
            y: row as i64 + 1,
        };

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
                        ExcelData::DateTimeIso(ref value) => CellValue::Text(value.to_string()),
                        ExcelData::DurationIso(ref value) => CellValue::Text(value.to_string()),
                        ExcelData::Float(ref value) => {
                            CellValue::unpack_str_float(&value.to_string(), CellValue::Blank)
                        }
                        // TODO(ddimaria): implement when implementing Instant
                        // ExcelData::DateTime(ref value) => match value.is_datetime() {
                        //     true => value.as_datetime().map_or_else(
                        //         || CellValue::Blank,
                        //         |v| CellValue::Instant(v.into()),
                        //     ),
                        //     false => CellValue::Text(value.to_string()),
                        // },
                        // TODO(ddimaria): remove when implementing Instant
                        ExcelData::DateTime(ref value) => match value.is_datetime() {
                            true => value.as_datetime().map_or_else(
                                || CellValue::Blank,
                                |v| CellValue::Text(v.to_string()),
                            ),
                            false => CellValue::Text(value.to_string()),
                        },
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
            }
            // add new sheets
            ops.push(Operation::AddSheetSchema {
                schema: export_sheet(&sheet),
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

        // this is not expensive
        let bytes = Bytes::from(file);
        let builder = ParquetRecordBatchReaderBuilder::try_new(bytes)?;

        // headers
        let metadata = builder.metadata();
        let total_size = metadata.file_metadata().num_rows() as u32;
        let fields = metadata.file_metadata().schema().get_fields();
        let headers: Vec<CellValue> = fields.iter().map(|f| f.name().into()).collect();
        let mut width = headers.len() as u32;

        ops.push(Operation::SetCellValues {
            sheet_pos: (insert_at.x, insert_at.y, sheet_id).into(),
            values: CellValues::from_flat_array(headers.len() as u32, 1, headers),
        });

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
                let values: CellValues = col.try_into()?;

                let operations = Operation::SetCellValues {
                    sheet_pos: (
                        insert_at.x + col_index as i64,
                        insert_at.y + (row_index * num_rows) as i64 + 1,
                        sheet_id,
                    )
                        .into(),
                    values,
                };
                ops.push(operations);

                // update the progress bar every time there's a new operation
                if cfg!(target_family = "wasm") {
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
    use super::read_utf16;
    use super::*;
    use crate::CellValue;
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

        const SIMPLE_CSV: &str =
            "city,region,country,population\nSouthborough,MA,United States,a lot of people";

        let ops = gc.import_csv_operations(sheet_id, SIMPLE_CSV.as_bytes(), "smallpop.csv", pos);
        assert_eq!(ops.as_ref().unwrap().len(), 1);
        assert_eq!(
            ops.unwrap()[0],
            Operation::SetCellValues {
                sheet_pos: SheetPos {
                    x: 0,
                    y: 0,
                    sheet_id
                },
                values: CellValues::from(vec![
                    vec!["city", "Southborough"],
                    vec!["region", "MA"],
                    vec!["country", "United States"],
                    vec!["population", "a lot of people"]
                ]),
            }
        );
    }

    #[test]
    #[parallel]
    fn imports_a_long_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 1, y: 2 };

        let mut csv = String::new();
        for i in 0..IMPORT_LINES_PER_OPERATION * 2 + 150 {
            csv.push_str(&format!("city{},MA,United States,{}\n", i, i * 1000));
        }

        let ops = gc.import_csv_operations(sheet_id, csv.as_bytes(), "long.csv", pos);
        assert_eq!(ops.as_ref().unwrap().len(), 3);
        let first_pos = match ops.as_ref().unwrap()[0] {
            Operation::SetCellValues { sheet_pos, .. } => sheet_pos,
            _ => panic!("Expected SetCellValues operation"),
        };
        let second_pos = match ops.as_ref().unwrap()[1] {
            Operation::SetCellValues { sheet_pos, .. } => sheet_pos,
            _ => panic!("Expected SetCellValues operation"),
        };
        let third_pos = match ops.as_ref().unwrap()[2] {
            Operation::SetCellValues { sheet_pos, .. } => sheet_pos,
            _ => panic!("Expected SetCellValues operation"),
        };
        assert_eq!(first_pos.x, 1);
        assert_eq!(second_pos.x, 1);
        assert_eq!(third_pos.x, 1);
        assert_eq!(first_pos.y, 2);
        assert_eq!(second_pos.y, 2 + IMPORT_LINES_PER_OPERATION as i64);
        assert_eq!(third_pos.y, 2 + IMPORT_LINES_PER_OPERATION as i64 * 2);

        let first_values = match ops.as_ref().unwrap()[0] {
            Operation::SetCellValues { ref values, .. } => values,
            _ => panic!("Expected SetCellValues operation"),
        };
        assert_eq!(
            first_values.get(0, 0),
            Some(&CellValue::Text("city0".into()))
        );
    }

    #[test]
    #[parallel]
    fn import_excel() {
        let mut gc = GridController::test_blank();
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
        let mut gc = GridController::test_blank();
        let file = include_bytes!("../../../test-files/invalid.xlsx");
        let result = gc.import_excel(file.to_vec(), "invalid.xlsx", None);
        assert!(result.is_err());
    }
}
