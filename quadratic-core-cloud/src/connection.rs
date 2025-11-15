use std::sync::Arc;

use bytes::Bytes;
use quadratic_core::{
    Pos, Rect,
    a1::A1Selection,
    controller::{GridController, transaction_types::JsConnectionResult},
    grid::{ConnectionKind, HANDLEBARS_REGEX_COMPILED, SheetId},
};
use serde_json::json;
use tokio::sync::Mutex;

use crate::error::{CoreCloudError, Result};

/// Replace handlebars {{A1}} style references with actual cell values
fn replace_handlebars(
    grid: &mut GridController,
    query: &str,
    default_sheet_id: SheetId,
) -> Result<String> {
    let mut result = String::new();
    let mut last_match_end = 0;

    let context = grid.a1_context();
    for cap in HANDLEBARS_REGEX_COMPILED.captures_iter(query) {
        let Ok(cap) = cap else {
            continue;
        };

        let Some(whole_match) = cap.get(0) else {
            continue;
        };

        result.push_str(&query[last_match_end..whole_match.start()]);

        let content = cap.get(1).map(|m| m.as_str().trim()).unwrap_or("");
        let selection = A1Selection::parse_a1(content, default_sheet_id, context).map_err(|e| {
            CoreCloudError::Core(format!("Error parsing A1 reference '{}': {}", content, e))
        })?;

        // connections support either one cell or a 1d range of cells (ie,
        // one column or row), which are entered as a comma-delimited list
        // of entries (e.g., "2,3,10,1,...") in the query

        if !selection.is_1d_range(context) {
            return Err(CoreCloudError::Core(
                "Connections only supports one cell or a 1d range of cells".to_string(),
            ));
        }

        let Some(sheet) = grid.try_sheet(selection.sheet_id) else {
            return Err(CoreCloudError::Core(format!(
                "Sheet not found for selection: {}",
                content
            )));
        };

        let rects = sheet.selection_to_rects(&selection, false, false, true, context);
        if rects.len() > 1 {
            return Err(CoreCloudError::Core(
                "Connections only supports one cell or a 1d range of cells".to_string(),
            ));
        }
        let rect = rects[0];
        result.push_str(&get_cells_comma_delimited_string(sheet, rect));

        last_match_end = whole_match.end();
    }

    // Add the remaining part of the string
    result.push_str(&query[last_match_end..]);

    Ok(result)
}

/// Returns a string of cells for a connection. For more than one cell, the
/// cells are comma-delimited.
fn get_cells_comma_delimited_string(sheet: &quadratic_core::grid::Sheet, rect: Rect) -> String {
    let mut response = String::new();
    for y in rect.y_range() {
        for x in rect.x_range() {
            if let Some(cell) = sheet.display_value(Pos { x, y }) {
                if !response.is_empty() {
                    response.push(',');
                }
                response.push_str(&cell.to_get_cells());
            }
        }
    }
    response
}

pub(crate) async fn run_connection(
    grid: Arc<Mutex<GridController>>,
    query: &str,
    connection_kind: ConnectionKind,
    connection_id: &str,
    transaction_id: &str,
    team_id: &str,
    token: &str,
    connection_url: &str,
    sheet_id: SheetId,
) -> Result<()> {
    let start_time = std::time::Instant::now();
    tracing::info!(
        "🔌 [Connection] Starting {} execution for transaction: {}",
        connection_kind,
        transaction_id
    );

    // Replace handlebars with actual cell values
    let processed_query = {
        let mut grid_lock = grid.lock().await;
        replace_handlebars(&mut *grid_lock, query, sheet_id)?
    };

    if processed_query != query {
        ::tracing::info!(
            "🔌 [Connection] Replaced handlebars in query (original length: {}, processed length: {})",
            query.len(),
            processed_query.len()
        );
    }

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
    connection_url: &str,
) -> Result<(JsConnectionResult, Option<String>)> {
    let kind = connection_kind.to_string().to_lowercase();
    let url = format!("{connection_url}/{kind}/query");

    ::tracing::info!(
        "🔌 [Connection] Executing query to {} (connection_id: {}, team_id: {})",
        url,
        connection_id,
        team_id
    );

    let client = reqwest::Client::new();
    let request = client
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-team-id", team_id)
        .json(&json!({
            "query": query,
            "connection_id": connection_id,
        }));

    let (response, std_error) = match request.send().await {
        Ok(resp) => {
            ::tracing::info!(
                "🔌 [Connection] Received response with status: {}",
                resp.status()
            );
            match resp.bytes().await {
                Ok(bytes) => {
                    ::tracing::info!("🔌 [Connection] Response data size: {} bytes", bytes.len());
                    (bytes, None)
                }
                Err(e) => {
                    let error_msg = format!("Error reading response bytes: {}", e);
                    ::tracing::error!("❌ [Connection] {}", error_msg);
                    (Bytes::new(), Some(error_msg))
                }
            }
        }
        Err(e) => {
            let error_msg = format!("Error sending request to {}: {}", url, e);
            ::tracing::error!("❌ [Connection] {}", error_msg);
            (Bytes::new(), Some(error_msg))
        }
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
