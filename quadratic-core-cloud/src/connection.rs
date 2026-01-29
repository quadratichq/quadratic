use bytes::Bytes;
use quadratic_core::{
    controller::{GridController, transaction_types::JsConnectionResult},
    grid::{ConnectionKind, SheetId},
};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::error::{CoreCloudError, Result};

pub(crate) fn build_request(
    url: &str,
    token: &str,
    team_id: &str,
    body: &serde_json::Value,
) -> reqwest::RequestBuilder {
    let client = reqwest::Client::new();
    client
        .post(url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-team-id", team_id)
        .json(body)
}

/// Parameters for running a connection
pub(crate) struct ConnectionParams<'a> {
    pub grid: Arc<Mutex<GridController>>,
    pub query: &'a str,
    pub connection_kind: ConnectionKind,
    pub connection_id: &'a str,
    pub transaction_id: &'a str,
    pub team_id: &'a str,
    pub token: &'a str,
    pub connection_url: &'a str,
    pub sheet_id: SheetId,
}

/// Runs a connection.
///
/// This function will replace handlebars with actual cell values and execute the connection.
/// It will then return the result of the connection execution.
pub(crate) async fn run_connection(params: ConnectionParams<'_>) -> Result<()> {
    let ConnectionParams {
        grid,
        query,
        connection_kind,
        connection_id,
        transaction_id,
        team_id,
        token,
        connection_url,
        sheet_id,
    } = params;

    let start_time = std::time::Instant::now();
    tracing::info!(
        "[Connection] Starting {} execution for transaction: {}",
        connection_kind,
        transaction_id
    );

    // Replace handlebars with actual cell values
    let processed_query = {
        let grid_lock = grid.lock().await;
        grid_lock
            .replace_handlebars(None, query, sheet_id)
            .map_err(|e| CoreCloudError::Core(e.to_string()))?
    };

    let (result, std_error) = execute(
        &processed_query,
        connection_kind,
        connection_id,
        transaction_id,
        team_id,
        token,
        connection_url,
    )
    .await?;

    let success_or_failure = match std_error.is_none() {
        true => "succeeded",
        false => "failed",
    };

    tracing::info!(
        "[Connection] {connection_kind} execution {success_or_failure} for transaction: {transaction_id} (duration: {:.2}ms, data size: {} bytes)",
        start_time.elapsed().as_secs_f64() * 1000.0,
        result.data.len()
    );

    grid.lock()
        .await
        .connection_complete(result.transaction_id, result.data, None, std_error, None)
        .map_err(|e| CoreCloudError::Core(e.to_string()))?;

    Ok(())
}

/// Executes a connection.
///
/// This function will send the query to the connection endpoint and return the result.
pub(crate) async fn execute(
    query: &str,
    connection_kind: ConnectionKind,
    connection_id: &str,
    transaction_id: &str,
    team_id: &str,
    token: &str,
    connection_url: &str,
) -> Result<(JsConnectionResult, Option<String>)> {
    let kind = connection_kind.to_string().to_lowercase();
    let url = format!("{connection_url}/{kind}/query");

    tracing::info!(
        "[Connection] Executing query to {url} (connection_id: {connection_id}, team_id: {team_id}, transaction_id: {transaction_id})",
    );

    let body = json!({
        "query": query,
        "connection_id": connection_id,
    });
    let request = build_request(&url, token, team_id, &body);

    let (response, std_error) = match request.send().await {
        Ok(resp) => match resp.bytes().await {
            Ok(bytes) => (bytes, None),
            Err(e) => (
                Bytes::new(),
                Some(format!("Error reading response bytes: {}", e)),
            ),
        },
        Err(e) => (
            Bytes::new(),
            Some(format!("Error sending request to {}: {}", url, e)),
        ),
    };

    // just log the std_error if it exists
    if let Some(std_error) = &std_error {
        tracing::error!("[Connection] {}", std_error);
    }

    let result = JsConnectionResult {
        transaction_id: transaction_id.to_string(),
        data: response.to_vec(),
    };

    Ok((result, std_error))
}

/// Fetches stock prices from the connection service.
pub(crate) async fn fetch_stock_prices(
    token: &str,
    team_id: &str,
    connection_url: &str,
    identifier: &str,
    start_date: Option<&str>,
    end_date: Option<&str>,
    frequency: Option<&str>,
) -> Result<serde_json::Value> {
    let url = format!("{connection_url}/financial/stock-prices");

    tracing::info!("[Connection] Fetching stock prices for {identifier} from {url}",);

    let body = json!({
        "identifier": identifier,
        "start_date": start_date,
        "end_date": end_date,
        "frequency": frequency,
    });
    let request = build_request(&url, token, team_id, &body);
    let response = request
        .send()
        .await
        .map_err(|e| CoreCloudError::Connection(format!("HTTP request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(CoreCloudError::Connection(format!(
            "Stock prices request failed with status {}: {}",
            status, body
        )));
    }

    let json_value: serde_json::Value = response
        .json()
        .await
        .map_err(|e| CoreCloudError::Connection(format!("Failed to parse response: {}", e)))?;

    Ok(json_value)
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
            "http://localhost:3003",
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
