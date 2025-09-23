use quadratic_rust_shared::{
    arrow::object_store::{list_objects, new_s3_object_store},
    synced::{
        mixpanel::{client::new_mixpanel_client, events::ExportParams},
        upload_to_s3,
    },
};

use crate::config::Config;

async fn process_mixpanel(config: &Config) {
    let client = new_mixpanel_client();
    let (s3, _) = new_s3_object_store(
        "mixpanel-data",
        "us-east-1",
        "test",
        "test",
        Some("http://localhost:4566"),
    )
    .unwrap();
    let num_objects = list_objects(&s3, None).await.unwrap().len();

    // if we don't have any objects, we need to export the last 30 days
    let num_days = if num_objects > 0 { 0 } else { 30 };
    let end_date = chrono::Utc::now().date_naive();
    let start_date = end_date - chrono::Duration::days(num_days);

    println!("Exporting events from {} to {}...", start_date, end_date);

    let params = ExportParams {
        from_date: start_date,
        to_date: end_date,
        events: None,
        r#where: None,
    };

    let start_time = std::time::Instant::now();
    let events = client.export_events_as_rows(params).await.unwrap();

    println!("Exported {} event dates", events.len());

    let (num_files, total_records) = upload_to_s3(&s3, events).await.unwrap();

    println!(
        "Time taken to write {} events to parquet for {} days: {:?}",
        total_records,
        num_files,
        start_time.elapsed()
    );
}
