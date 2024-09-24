use anyhow::Result;
use bytes::Bytes;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

use crate::{arrow::arrow_col_to_cell_value_vec, CellValue};

pub fn parquet_to_vec(file: Vec<u8>) -> Result<Vec<Vec<CellValue>>> {
    dbgjs!("a");
    if file.is_empty() {
        return Ok(vec![]);
    }

    // this is not expensive
    let bytes = Bytes::from(file);
    let builder = ParquetRecordBatchReaderBuilder::try_new(bytes)?;

    // headers
    let metadata = builder.metadata();
    let total_size = metadata.file_metadata().num_rows() as usize;
    let fields = metadata.file_metadata().schema().get_fields();

    let headers: Vec<CellValue> = fields.iter().map(|f| f.name().into()).collect();
    let width = headers.len();

    let mut output = vec![vec![CellValue::Blank; width]; total_size + 1];
    output[0] = headers;
    let reader = builder.build()?;

    for (row_index, batch) in reader.enumerate() {
        let batch = batch?;
        let num_cols = batch.num_columns();
        let num_rows = batch.num_rows();

        for col_index in 0..num_cols {
            let col = batch.column(col_index);
            let values = arrow_col_to_cell_value_vec(col)?;

            for (index, value) in values.into_iter().enumerate() {
                let new_row_index = (row_index * num_rows) + index + 1;
                output[new_row_index][col_index] = value;
            }
        }
    }

    Ok(output)
}
#[cfg(test)]
mod test {
    use std::fs::File;
    use std::io::Read;

    use super::*;

    const PARQUET_FILE: &str = "../quadratic-rust-shared/data/parquet/alltypes_plain.parquet";

    #[test]
    fn test_parquet_to_vec() {
        let mut file = File::open(PARQUET_FILE).unwrap();
        let metadata = std::fs::metadata(PARQUET_FILE).expect("unable to read metadata");
        let mut buffer = vec![0; metadata.len() as usize];
        file.read_exact(&mut buffer).expect("buffer overflow");

        let _results = parquet_to_vec(buffer);
        // println!("{:?}", results);
    }
}
