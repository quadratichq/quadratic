use std::sync::Arc;

use bytes::Bytes;
use quadratic_core::{
    controller::{GridController, transaction_types::JsConnectionResult},
    grid::ConnectionKind,
};
use serde_json::json;
use tokio::sync::Mutex;

use crate::error::{CoreCloudError, Result};

pub(crate) async fn run_connection(
    grid: Arc<Mutex<GridController>>,
    query: &str,
    connection_kind: ConnectionKind,
    connection_id: &str,
    transaction_id: &str,
    team_id: &str,
    token: &str,
) -> Result<()> {
    let start_time = std::time::Instant::now();
    tracing::info!(
        "🔌 [Connection] Starting {} execution for transaction: {}",
        connection_kind,
        transaction_id
    );

    let (result, std_error) = execute(
        query,
        connection_kind,
        connection_id,
        transaction_id,
        team_id,
        token,
    )
    .await?;

    let elapsed = start_time.elapsed();
    let data_size = result.data.len();

    if std_error.is_none() {
        tracing::info!(
            "✅ [Connection] {} execution completed successfully for transaction: {} (duration: {:.2}ms, data size: {} bytes)",
            connection_kind,
            transaction_id,
            elapsed.as_secs_f64() * 1000.0,
            data_size
        );
    } else {
        tracing::error!(
            "❌ [Connection] {} execution failed for transaction: {} (duration: {:.2}ms, error: {:?})",
            connection_kind,
            transaction_id,
            elapsed.as_secs_f64() * 1000.0,
            std_error
        );
    }

    grid.lock()
        .await
        .connection_complete(result.transaction_id, result.data, None, std_error, None)
        .map_err(|e| CoreCloudError::Core(e.to_string()))?;

    Ok(())
}

pub(crate) async fn execute(
    query: &str,
    connection_kind: ConnectionKind,
    connection_id: &str,
    transaction_id: &str,
    team_id: &str,
    token: &str,
) -> Result<(JsConnectionResult, Option<String>)> {
    let kind = connection_kind.to_string().to_lowercase();
    let url = format!("http://localhost:3003/{kind}/query");
    let client = reqwest::Client::new();
    let request = client
        .post(url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-team-id", team_id)
        .json(&json!({
            "query": query,
            "connection_id": connection_id,
        }));
    let (response, std_error) = match request.send().await?.bytes().await {
        Ok(response) => (response, None),
        Err(e) => (Bytes::new(), Some(e.to_string())),
    };
    let result = JsConnectionResult {
        transaction_id: transaction_id.to_string(),
        data: response.to_vec(),
    };

    Ok((result, std_error))
}

#[cfg(test)]
mod tests {

    use super::*;
    use std::time::Instant;

    async fn test_execute(query: &str) -> (JsConnectionResult, Option<String>) {
        let start = Instant::now();
        let token = "M2M_AUTH_TOKEN".to_string();
        let connection_kind = ConnectionKind::Postgres;
        let connection_id = "2f153e3a-aa1f-40e9-960e-759f3047bf85".to_string();
        let team_id = "5b5dd6a8-04d8-4ca5-baeb-2cf3e80c1d05".to_string();
        let (result, std_error) = execute(
            query,
            connection_kind,
            &connection_id,
            "test",
            &team_id,
            &token,
        )
        .await
        .unwrap();
        let end = Instant::now();
        println!("time: {:?}", end.duration_since(start));
        // println!("result: {:#?}", result);

        (result, std_error)
    }

    #[tokio::test]
    async fn test_execute_postgres() {
        let query = "select * from \"Connection\" limit 1";
        let _result = test_execute(query).await;
    }
}
