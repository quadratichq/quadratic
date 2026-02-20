use std::sync::Arc;

use axum::Json;
use axum::{Extension, response::IntoResponse};
use chrono::NaiveDate;
use quadratic_rust_shared::intrinio::client::StockPriceFrequency;
use serde::Deserialize;

use crate::error::Result;
use crate::state::State;

/// Request body for the stock prices endpoint.
#[derive(Debug, Deserialize)]
pub(crate) struct StockPricesRequest {
    /// The stock ticker symbol (e.g., "AAPL").
    pub identifier: String,
    /// Optional start date for the price data (YYYY-MM-DD).
    pub start_date: Option<NaiveDate>,
    /// Optional end date for the price data (YYYY-MM-DD).
    pub end_date: Option<NaiveDate>,
    /// Optional frequency for the price data (daily, weekly, monthly, quarterly, yearly).
    /// Defaults to daily if not specified.
    pub frequency: Option<StockPriceFrequency>,
}

/// Get the stock prices for a security.
///
/// # Arguments
///
/// * `state` - The state of the application.
/// * `request` - The JSON request body containing identifier, start_date, and end_date.
///
/// # Returns
///
/// A JSON response containing the stock prices.
pub(crate) async fn stock_prices(
    state: Extension<Arc<State>>,
    Json(request): Json<StockPricesRequest>,
) -> Result<impl IntoResponse> {
    tracing::info!(?request, "Fetching stock prices");

    let stock_prices = state
        .intrinio_client
        .get_security_stock_prices(
            &request.identifier,
            request.start_date,
            request.end_date,
            request.frequency,
        )
        .await?;

    Ok(Json(stock_prices))
}

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;

    use crate::test_util::new_state;

    use super::*;

    #[tokio::test]
    async fn test_stock_prices() {
        let state = Extension(Arc::new(new_state().await));
        let request = StockPricesRequest {
            identifier: "AAPL".to_string(),
            start_date: NaiveDate::from_ymd_opt(2025, 1, 1),
            end_date: NaiveDate::from_ymd_opt(2025, 1, 31),
            frequency: None, // defaults to daily
        };

        let response = stock_prices(state.clone(), Json(request))
            .await
            .expect("stock_prices should succeed")
            .into_response();

        let body_bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("failed to read body");
        let body_str = String::from_utf8_lossy(&body_bytes);
        println!("response body (daily): {body_str}");
    }

    #[tokio::test]
    async fn test_stock_prices_weekly() {
        let state = Extension(Arc::new(new_state().await));
        let request = StockPricesRequest {
            identifier: "AAPL".to_string(),
            start_date: NaiveDate::from_ymd_opt(2025, 1, 1),
            end_date: NaiveDate::from_ymd_opt(2025, 1, 31),
            frequency: Some(StockPriceFrequency::Weekly),
        };

        let response = stock_prices(state, Json(request))
            .await
            .expect("stock_prices should succeed")
            .into_response();

        let body_bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("failed to read body");
        let body_str = String::from_utf8_lossy(&body_bytes);
        println!("response body (weekly): {body_str}");
    }
}
