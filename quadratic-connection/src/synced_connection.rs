use quadratic_rust_shared::{
    quadratic_api::get_connections_by_type,
    synced::{
        get_last_date_processed,
        mixpanel::{client::MixpanelClient, events::ExportParams},
        upload,
    },
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{ConnectionError, Result},
    state::settings::Settings,
};

#[derive(Debug, Deserialize, Serialize)]
pub struct MixpanelConnection {
    pub api_secret: String,
    pub project_id: String,
}

pub(crate) async fn process_mixpanel_connections(settings: &Settings) -> Result<()> {
    let connections = get_connections_by_type::<MixpanelConnection>(
        &settings.quadratic_api_uri,
        &settings.m2m_auth_token,
        "MIXPANEL",
    )
    .await?;

    tracing::info!("Found {} Mixpanel connections", connections.len());

    for connection in connections {
        process_mixpanel_connection(settings, connection.type_details, connection.uuid).await?;
    }

    Ok(())
}

pub(crate) async fn process_mixpanel_connection(
    settings: &Settings,
    connection: MixpanelConnection,
    connection_id: Uuid,
) -> Result<()> {
    let s3 = settings
        .object_store
        .clone()
        .ok_or_else(|| ConnectionError::Config("Object store not found".to_string()))?;

    let today = chrono::Utc::now().date_naive();
    let prefix = format!("{}/{}", connection_id, "events");
    let end_date = today;
    let start_time = std::time::Instant::now();
    let mut start_date = chrono::Utc::now().date_naive() - chrono::Duration::days(30);

    // if we have any objects, use the last date processed
    if let Ok(Some(s3_start_date)) = get_last_date_processed(&s3, None).await {
        start_date = s3_start_date;
    };

    let MixpanelConnection {
        ref api_secret,
        ref project_id,
    } = connection;
    let client = MixpanelClient::new(api_secret, project_id);

    tracing::info!(
        "Exporting Mixpanel events from {} to {}...",
        start_date,
        end_date
    );

    let params = ExportParams::new(start_date, end_date);
    let parquet_data = client.export_events(params).await.unwrap();
    let num_files = upload(&s3, &prefix, parquet_data).await.unwrap();

    tracing::info!(
        "Processed {} Mixpanel files in {:?}",
        num_files,
        start_time.elapsed()
    );

    Ok(())
}

#[cfg(test)]
mod tests {

    use crate::test_util::new_state;

    use super::*;

    #[tokio::test]
    async fn test_process_mixpanel() {
        let state = new_state().await;
        process_mixpanel_connections(&state.settings).await.unwrap();
    }
}
