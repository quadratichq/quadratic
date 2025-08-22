//! Test utilities

#[cfg(feature = "benchmark")]
pub mod benchmark;

#[cfg(any(test, feature = "test"))]
pub mod request;

include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/auto_gen_path.rs"));

pub fn get_snowflake_parquet_path() -> String {
    format!(
        "{}/{}",
        DATA_PATH, "/parquet/all_native_data_types-snowflake.parquet"
    )
}
