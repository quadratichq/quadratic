use bytes::Bytes;
use chrono::NaiveDate;
use object_store::ObjectStore;
use serde::Deserialize;
use std::{collections::HashMap, sync::Arc};
use uuid::Uuid;

use crate::{
    SharedError,
    arrow::object_store::{list_objects, upload_multipart},
    error::Result,
};

pub mod mixpanel;

const DATE_FORMAT: &str = "%Y-%m-%d";

/// Convert an error to a SharedError.
fn synced_error(e: impl ToString) -> SharedError {
    SharedError::Synced(e.to_string())
}

/// Parse a date from a string.
fn parse_file_date(string_date: &str) -> Result<NaiveDate> {
    // remove .parquet from the end of the string
    let string_date = string_date.to_ascii_lowercase().replace(".parquet", "");
    let date = NaiveDate::parse_from_str(&string_date, DATE_FORMAT).map_err(synced_error)?;
    Ok(date)
}

/// Get the date from the location of the file.
fn get_date_from_location(location: &str) -> Result<NaiveDate> {
    if !location.to_ascii_lowercase().contains(".parquet") {
        return Err(synced_error("Not a parquet file"));
    }

    let parts = location.split('/').collect::<Vec<&str>>();
    let string_date = parts
        .last()
        .ok_or_else(|| synced_error("No date found in location"))?;

    parse_file_date(string_date)
}

/// Get the first date of the objects in the object store using the date in the location.
pub async fn get_first_and_last_date_processed(
    object_store: &Arc<dyn ObjectStore>,
    prefix: Option<&str>,
) -> Result<(Option<NaiveDate>, Option<NaiveDate>)> {
    let objects = list_objects(object_store, prefix).await?;
    let dates = objects
        .iter()
        .flat_map(|o| get_date_from_location(o.location.as_ref()))
        .collect::<Vec<NaiveDate>>();

    let first_date = dates.iter().min().cloned();
    let last_date = dates.iter().max().cloned();

    Ok((first_date, last_date))
}

/// Get the first date of the objects in the object store using the date in the location.
pub async fn get_first_date_processed(
    object_store: &Arc<dyn ObjectStore>,
    prefix: Option<&str>,
) -> Result<Option<NaiveDate>> {
    let objects = list_objects(object_store, prefix).await?;
    let first_date = objects
        .iter()
        .flat_map(|o| get_date_from_location(o.location.as_ref()))
        .collect::<Vec<NaiveDate>>()
        .iter()
        .min()
        .cloned();

    Ok(first_date)
}

/// Get the last date of the objects in the object store using the date in the location.
pub async fn get_last_date_processed(
    object_store: &Arc<dyn ObjectStore>,
    prefix: Option<&str>,
) -> Result<Option<NaiveDate>> {
    let objects = list_objects(object_store, prefix).await?;
    let last_date = objects
        .iter()
        .flat_map(|o| get_date_from_location(o.location.as_ref()))
        .collect::<Vec<NaiveDate>>()
        .iter()
        .max()
        .cloned();

    Ok(last_date)
}

/// Using a start and end date, get all dates of missing objects
pub async fn get_missing_dates(
    object_store: &Arc<dyn ObjectStore>,
    prefix: Option<&str>,
    start_date: NaiveDate,
    end_date: NaiveDate,
    dates_to_exclude: Vec<NaiveDate>,
) -> Result<Vec<NaiveDate>> {
    // Get all existing dates from object store
    let objects = list_objects(object_store, prefix).await?;
    let mut existing_dates: Vec<NaiveDate> = objects
        .iter()
        .filter_map(|o| get_date_from_location(o.location.as_ref()).ok())
        .collect();
    existing_dates.extend(dates_to_exclude);
    existing_dates.sort();

    // Generate all dates in the range
    let mut missing_dates = Vec::new();
    let mut current_date = start_date;

    while current_date <= end_date {
        if !existing_dates.contains(&current_date) {
            missing_dates.push(current_date);
        }
        current_date += chrono::Duration::days(1);
    }

    Ok(missing_dates)
}

/// Get the missing date ranges in the object store.
pub async fn get_missing_date_ranges(
    object_store: &Arc<dyn ObjectStore>,
    prefix: Option<&str>,
    start_date: NaiveDate,
    end_date: NaiveDate,
    dates_to_exclude: Vec<NaiveDate>,
) -> Result<Vec<(NaiveDate, NaiveDate)>> {
    let missing_dates =
        get_missing_dates(object_store, prefix, start_date, end_date, dates_to_exclude).await?;

    // if dates are sequential without missing a date, combine into a range
    let mut date_ranges = Vec::new();

    if missing_dates.is_empty() {
        return Ok(date_ranges);
    }

    let mut range_start = missing_dates[0];
    let mut range_end = missing_dates[0];

    for missing_date in missing_dates.into_iter().skip(1) {
        let current_date = missing_date;

        // check if current date is the next day after range_end
        if current_date == range_end + chrono::Duration::days(1) {
            range_end = current_date;
        } else {
            // gap found, save current range and start a new one
            date_ranges.push((range_start, range_end));
            range_start = current_date;
            range_end = current_date;
        }
    }

    // push the last range
    date_ranges.push((range_start, range_end));

    Ok(date_ranges)
}

/// Get the start and end dates for a connection from the object store.
pub async fn dates_to_sync(
    object_store: &Arc<dyn ObjectStore>,
    connection_id: Uuid,
    table_name: &str,
    sync_start_date: NaiveDate,
    dates_to_exclude: Vec<NaiveDate>,
) -> Result<Vec<(NaiveDate, NaiveDate)>> {
    let today = chrono::Utc::now().date_naive();
    let prefix = object_store_path(connection_id, table_name);
    let end_date = today;

    let missing_date_ranges = get_missing_date_ranges(
        &object_store,
        Some(&prefix),
        sync_start_date,
        end_date,
        dates_to_exclude,
    )
    .await?;

    Ok(missing_date_ranges)
}

/// Split a date range into `chunk_size` chunks.
pub fn chunk_date_range(
    start_date: NaiveDate,
    end_date: NaiveDate,
    chunk_size: u32,
) -> Vec<(NaiveDate, NaiveDate)> {
    let mut chunks = Vec::new();
    let mut current_start = start_date;

    while current_start <= end_date {
        let current_end = std::cmp::min(
            current_start + chrono::Duration::days(chunk_size as i64 - 1),
            end_date,
        );
        chunks.push((current_start, current_end));
        current_start = current_end + chrono::Duration::days(1);
    }

    chunks
}

/// Get the object store path for a table
pub fn object_store_path(connection_id: Uuid, table_name: &str) -> String {
    format!("{}/{}", connection_id, table_name)
}

/// Upload multiple parquet files to S3 from pre-generated bytes
///
/// Each key is a date, and the value is the parquet file bytes.
/// Returns the number of files uploaded.
pub async fn upload(
    object_store: &Arc<dyn ObjectStore>,
    prefix: &str,
    data: HashMap<String, Bytes>,
) -> Result<usize> {
    let num_files = data.len();

    for (key, parquet_bytes) in data.into_iter() {
        let file_name = format!("{}/{}.parquet", prefix, key);

        upload_multipart(object_store, &file_name, &parquet_bytes)
            .await
            .map_err(|e| {
                SharedError::Synced(format!(
                    "Failed to upload parquet file {} to S3: {}",
                    file_name, e
                ))
            })?;
    }

    Ok(num_files)
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
mod tests {
    use super::*;
    use crate::arrow::object_store::new_filesystem_object_store;
    use bytes::Bytes;
    use chrono::NaiveDate;
    use std::{collections::HashMap, fs};
    use tempfile::TempDir;

    fn create_temp_object_store() -> (TempDir, Arc<dyn ObjectStore>) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let path = temp_dir.path().to_str().expect("Invalid temp path");
        let (store, _) = new_filesystem_object_store(path).expect("Failed to create object store");
        (temp_dir, store)
    }

    fn create_test_parquet_files(temp_dir: &TempDir, dates: &[&str]) {
        for date in dates {
            let file_path = temp_dir.path().join(format!("{}.parquet", date));
            fs::write(&file_path, b"fake parquet data").expect("Failed to write test file");
        }
    }

    #[test]
    fn test_parse_file_date_valid() {
        let result = parse_file_date("2024-01-15.parquet").unwrap();
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());

        let result = parse_file_date("2024-01-15").unwrap();
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());

        let result = parse_file_date("2024-01-15.PARQUET").unwrap();
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());
    }

    #[test]
    fn test_parse_file_date_invalid() {
        let result = parse_file_date("invalid-date");
        assert!(result.is_err());

        let result = parse_file_date("2024-13-01");
        assert!(result.is_err());

        let result = parse_file_date("2024-01-32");
        assert!(result.is_err());

        let result = parse_file_date("");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_date_from_location_valid() {
        let result = get_date_from_location("2024-01-15.parquet").unwrap();
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());

        let result = get_date_from_location("data/events/2024-01-15.parquet").unwrap();
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());

        let result =
            get_date_from_location("s3://bucket/prefix/data/events/2024-12-25.parquet").unwrap();
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 12, 25).unwrap());
    }

    #[test]
    fn test_get_date_from_location_invalid() {
        let result = get_date_from_location("2024-01-15.txt");
        assert!(result.is_err());

        let result = get_date_from_location("");
        assert!(result.is_err());

        let result = get_date_from_location("data/events/");
        assert!(result.is_err());

        let result = get_date_from_location("invalid-date.parquet");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_last_date_processed_empty_store() {
        let (_temp_dir, store) = create_temp_object_store();

        let result = get_last_date_processed(&store, None).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), None);
    }

    #[tokio::test]
    async fn test_get_last_date_processed_with_files() {
        let (temp_dir, store) = create_temp_object_store();
        let dates = ["2024-01-01", "2024-01-15", "2024-01-10", "2024-02-01"];
        create_test_parquet_files(&temp_dir, &dates);

        let result = get_last_date_processed(&store, None)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 2, 1).unwrap());
    }

    #[tokio::test]
    async fn test_get_last_date_processed_with_prefix() {
        let (temp_dir, store) = create_temp_object_store();
        let events_dir = temp_dir.path().join("events");
        let logs_dir = temp_dir.path().join("logs");
        fs::create_dir(&events_dir).expect("Failed to create events dir");
        fs::create_dir(&logs_dir).expect("Failed to create logs dir");
        let events_file = events_dir.join("2024-01-15.parquet");
        fs::write(&events_file, b"events data").expect("Failed to write events file");
        let logs_file = logs_dir.join("2024-02-01.parquet");
        fs::write(&logs_file, b"logs data").expect("Failed to write logs file");

        let result = get_last_date_processed(&store, Some("events/"))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(result, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());
    }

    #[tokio::test]
    async fn test_get_last_date_processed_with_invalid_files() {
        let (temp_dir, store) = create_temp_object_store();
        let invalid_files = ["invalid-date.parquet", "2024-01-15.txt", "not-a-date"];

        for file in &invalid_files {
            let file_path = temp_dir.path().join(file);
            fs::write(&file_path, b"test data").expect("Failed to write test file");
        }

        let result = get_last_date_processed(&store, None).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_upload_single_file() {
        let (_temp_dir, store) = create_temp_object_store();
        let mut data = HashMap::new();
        let test_content = Bytes::from("test parquet data");
        data.insert("2024-01-15".to_string(), test_content.clone());

        let result = upload(&store, "events", data).await.unwrap();
        assert_eq!(result, 1);

        let objects = list_objects(&store, Some("events/")).await.unwrap();
        assert_eq!(objects.len(), 1);
        assert_eq!(
            objects[0].location.filename().unwrap(),
            "2024-01-15.parquet"
        );
    }

    #[tokio::test]
    async fn test_upload_multiple_files() {
        let (_temp_dir, store) = create_temp_object_store();
        let mut data = HashMap::new();
        let dates = ["2024-01-01", "2024-01-02", "2024-01-03"];

        for date in &dates {
            let content = Bytes::from(format!("test data for {}", date));
            data.insert(date.to_string(), content);
        }

        let result = upload(&store, "mixpanel", data).await.unwrap();
        assert_eq!(result, 3);

        let objects = list_objects(&store, Some("mixpanel/"))
            .await
            .expect("Failed to list objects");
        assert_eq!(objects.len(), 3);

        let mut uploaded_files: Vec<String> = objects
            .iter()
            .map(|obj| obj.location.filename().unwrap().to_string())
            .collect();
        uploaded_files.sort();

        let mut expected_files: Vec<String> = dates
            .iter()
            .map(|date| format!("{}.parquet", date))
            .collect();
        expected_files.sort();

        assert_eq!(uploaded_files, expected_files);
    }

    #[tokio::test]
    async fn test_upload_empty_data() {
        let (_temp_dir, store) = create_temp_object_store();
        let data = HashMap::new();
        let result = upload(&store, "events", data).await.unwrap();
        assert_eq!(result, 0);

        let objects = list_objects(&store, Some("events/")).await.unwrap();
        assert_eq!(objects.len(), 0);
    }

    #[tokio::test]
    async fn test_upload_with_nested_prefix() {
        let (_temp_dir, store) = create_temp_object_store();
        let mut data = HashMap::new();
        let test_content = Bytes::from("nested test data");
        data.insert("2024-01-15".to_string(), test_content);

        let result = upload(&store, "data/events/mixpanel", data).await.unwrap();
        assert_eq!(result, 1);

        let objects = list_objects(&store, Some("data/events/mixpanel/"))
            .await
            .unwrap();
        assert_eq!(objects.len(), 1);
        assert_eq!(
            objects[0].location.filename().unwrap(),
            "2024-01-15.parquet"
        );
    }

    #[test]
    fn test_deserialize_int_to_bool() {
        use serde::Deserialize;
        use serde_json;

        #[derive(Deserialize)]
        struct TestStruct {
            #[serde(deserialize_with = "deserialize_int_to_bool")]
            flag: Option<bool>,
        }

        let json = r#"{"flag": 0}"#;
        let result: TestStruct = serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(result.flag, Some(false));

        let json = r#"{"flag": 1}"#;
        let result: TestStruct = serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(result.flag, Some(true));

        let json = r#"{"flag": 42}"#;
        let result: TestStruct = serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(result.flag, Some(true));

        let json = r#"{"flag": null}"#;
        let result: TestStruct = serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(result.flag, None);
    }

    #[tokio::test]
    async fn test_integration_upload_and_get_last_date() {
        let (_temp_dir, store) = create_temp_object_store();
        let mut data = HashMap::new();
        let dates = ["2024-01-01", "2024-01-15", "2024-02-01"];

        for date in &dates {
            let content = Bytes::from(format!("data for {}", date));
            data.insert(date.to_string(), content);
        }

        let upload_result = upload(&store, "events", data).await.unwrap();
        assert_eq!(upload_result, 3);

        let last_date_result = get_last_date_processed(&store, Some("events/"))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            last_date_result,
            NaiveDate::from_ymd_opt(2024, 2, 1).unwrap()
        );
    }

    #[tokio::test]
    async fn test_get_missing_date_ranges_empty() {
        let (_temp_dir, store) = create_temp_object_store();

        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 5).unwrap();

        let result = get_missing_date_ranges(&store, None, start_date, end_date, vec![])
            .await
            .unwrap();

        // All dates are missing, should be one continuous range
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], (start_date, end_date));
    }

    #[tokio::test]
    async fn test_get_missing_date_ranges_consecutive() {
        let (temp_dir, store) = create_temp_object_store();

        // Create some files, leaving gaps
        let dates = ["2024-01-02", "2024-01-03", "2024-01-06"];
        create_test_parquet_files(&temp_dir, &dates);

        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 7).unwrap();

        let result = get_missing_date_ranges(&store, None, start_date, end_date, vec![])
            .await
            .unwrap();

        // Should have 3 ranges: [2024-01-01, 2024-01-01], [2024-01-04, 2024-01-05], [2024-01-07, 2024-01-07]
        assert_eq!(result.len(), 3);
        assert_eq!(
            result[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()
            )
        );
        assert_eq!(
            result[1],
            (
                NaiveDate::from_ymd_opt(2024, 1, 4).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 5).unwrap()
            )
        );
        assert_eq!(
            result[2],
            (
                NaiveDate::from_ymd_opt(2024, 1, 7).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 7).unwrap()
            )
        );
    }

    #[tokio::test]
    async fn test_get_missing_date_ranges_no_missing() {
        let (temp_dir, store) = create_temp_object_store();

        // Create all files in the range
        let dates = ["2024-01-01", "2024-01-02", "2024-01-03"];
        create_test_parquet_files(&temp_dir, &dates);

        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 3).unwrap();

        let result = get_missing_date_ranges(&store, None, start_date, end_date, vec![])
            .await
            .unwrap();

        // No missing dates
        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_get_missing_date_ranges_with_prefix() {
        let (temp_dir, store) = create_temp_object_store();

        // Create files with a prefix
        let prefix_dir = temp_dir.path().join("events");
        fs::create_dir(&prefix_dir).expect("Failed to create prefix directory");

        let dates = ["2024-01-02"];
        for date in dates {
            let file_path = prefix_dir.join(format!("{}.parquet", date));
            fs::write(&file_path, b"fake parquet data").expect("Failed to write test file");
        }

        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 3).unwrap();

        let result = get_missing_date_ranges(&store, Some("events/"), start_date, end_date, vec![])
            .await
            .unwrap();

        // Should have 2 ranges: [2024-01-01, 2024-01-01], [2024-01-03, 2024-01-03]
        assert_eq!(result.len(), 2);
        assert_eq!(
            result[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()
            )
        );
        assert_eq!(
            result[1],
            (
                NaiveDate::from_ymd_opt(2024, 1, 3).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 3).unwrap()
            )
        );
    }

    #[tokio::test]
    async fn test_object_store_path() {
        let connection_id = Uuid::new_v4();
        let table_name = "events";
        let path = object_store_path(connection_id, table_name);
        let expected = format!("{}/{}", connection_id, table_name);

        assert_eq!(path, expected);
    }

    // TODO(ddimaria): remove this ignore once we have parquet files mocked
    #[tokio::test]
    #[ignore]
    async fn test_dates_returns_correct_range() {
        let (_temp_dir, object_store) = create_temp_object_store();
        let connection_id = Uuid::new_v4();
        let table_name = "events";
        let sync_start_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let dates_to_exclude = vec![];
        let chunks = dates_to_sync(
            &object_store,
            connection_id,
            table_name,
            sync_start_date,
            dates_to_exclude,
        )
        .await
        .unwrap();
        assert_eq!(chunks.len(), 1);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 14).unwrap()
            )
        );
    }

    #[test]
    fn test_split_date_range_into_weeks() {
        use chrono::NaiveDate;

        // Test a simple 2-week range
        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 14).expect("Valid date");
        let chunks = chunk_date_range(start_date, end_date, 7);
        println!("chunks: {:?}", chunks);
        assert_eq!(chunks.len(), 2);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 7).unwrap()
            )
        );
        assert_eq!(
            chunks[1],
            (
                NaiveDate::from_ymd_opt(2024, 1, 8).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 14).unwrap()
            )
        );

        // Test a partial week
        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 3).expect("Valid date");
        let chunks = chunk_date_range(start_date, end_date, 7);

        assert_eq!(chunks.len(), 1);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 3).unwrap()
            )
        );

        // Test single day
        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let chunks = chunk_date_range(start_date, end_date, 7);

        assert_eq!(chunks.len(), 1);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()
            )
        );

        // Test exactly 7 days
        let start_date = NaiveDate::from_ymd_opt(2024, 1, 1).expect("Valid date");
        let end_date = NaiveDate::from_ymd_opt(2024, 1, 7).expect("Valid date");
        let chunks = chunk_date_range(start_date, end_date, 7);

        assert_eq!(chunks.len(), 1);
        assert_eq!(
            chunks[0],
            (
                NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
                NaiveDate::from_ymd_opt(2024, 1, 7).unwrap()
            )
        );
    }
}
