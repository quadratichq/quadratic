use anyhow::{Result, anyhow};
use bytes::Bytes;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

use crate::{CellValue, arrow::arrow_col_to_cell_value_vec};

use crate::{Array, ArraySize};

pub fn parquet_to_array(
    file: Vec<u8>,
    file_name: &str,
    updater: Option<impl Fn(&str, u32, u32)>,
) -> Result<Array> {
    let error = |message: String| anyhow!("Error parsing Parquet file {}: {}", file_name, message);

    if file.is_empty() {
        return Err(error("File is empty".to_string()));
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

    // create that will hold the data
    let array_size = ArraySize::new_or_err(width as u32, total_size as u32 + 1)
        .map_err(|e| error(e.to_string()))?;
    let mut cell_values = Array::new_empty(array_size);

    // add the header
    cell_values.set_row(0, &headers)?;

    let reader = builder.build()?;
    let mut current_size = 0;

    for batch in reader {
        let batch = batch?;
        let num_rows_in_batch = batch.num_rows();
        let num_cols_in_batch = batch.num_columns();

        for col_index in 0..num_cols_in_batch {
            let col = batch.column(col_index);
            let values = arrow_col_to_cell_value_vec(col)?;

            for (row_index, value) in values.into_iter().enumerate() {
                let y = row_index + current_size + 1;
                cell_values.set(col_index as u32, y as u32, value, false)?;
            }
        }

        current_size += num_rows_in_batch;

        // update the progress bar every time there's a new batch processed
        // parquet batches sizes are usually 1024 or less
        if let Some(updater) = &updater {
            updater(file_name, current_size as u32, total_size as u32);
        }
    }

    Ok(cell_values)
}
#[cfg(test)]
mod test {
    use std::fs::File;
    use std::io::Read;

    use super::*;

    const PARQUET_FILE: &str = "../quadratic-rust-shared/data/parquet/alltypes_plain.parquet";

    #[test]
    fn test_parquet_to_array() {
        let mut file = File::open(PARQUET_FILE).unwrap();
        let metadata = std::fs::metadata(PARQUET_FILE).expect("unable to read metadata");
        let mut buffer = vec![0; metadata.len() as usize];
        file.read_exact(&mut buffer).expect("buffer overflow");
        parquet_to_array(buffer, PARQUET_FILE, None::<fn(&str, u32, u32)>).unwrap();
    }
}
