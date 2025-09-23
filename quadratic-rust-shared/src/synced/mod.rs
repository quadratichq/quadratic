use object_store::ObjectStore;
use parquet::record::Row;
use serde::Deserialize;
use std::{collections::HashMap, sync::Arc};

use crate::{
    arrow::object_store::upload_multipart, error::Result, parquet::utils::vec_to_parquet_bytes,
};

pub mod mixpanel;

/// Upload multiple parquet files to S3
///
/// Each key is a date, and the value is a vector of records.
/// The function returns the number of files and the total number of records.
pub async fn upload_to_s3(
    object_store: &Arc<dyn ObjectStore>,
    data: HashMap<String, Vec<Row>>,
) -> Result<(usize, usize)> {
    let num_files = data.len();
    let mut total_records = 0;

    for (key, records) in data.into_iter() {
        let file_name = format!("{key}.parquet");
        total_records += records.len();
        let parquet = vec_to_parquet_bytes(records).unwrap();

        upload_multipart(object_store, &file_name, &parquet)
            .await
            .unwrap();
    }

    Ok((num_files, total_records))
}

pub fn deserialize_int_to_bool<'de, D>(deserializer: D) -> Result<Option<bool>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    match Option::<u32>::deserialize(deserializer)? {
        Some(0) => Ok(Some(false)),
        Some(_) => Ok(Some(true)),
        None => Ok(None),
    }
}

#[cfg(test)]
pub(crate) fn s3_object_store() -> Arc<dyn ObjectStore> {
    use crate::arrow::object_store::new_s3_object_store;

    let (s3, _) = new_s3_object_store(
        "mixpanel-data",
        "us-east-1",
        "test",
        "test",
        Some("http://localhost:4566"),
    )
    .unwrap();

    s3
}
