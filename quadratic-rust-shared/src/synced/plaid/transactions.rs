use chrono::NaiveDate;
use serde_json::Value;

use crate::error::Result;
use crate::synced::plaid::client::PlaidClient;

impl PlaidClient {
    /// Get transactions for a specific date range using /transactions/get
    pub async fn get_transactions(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<Value>> {
        self.fetch_paginated_array(
            "transactions/get",
            start_date,
            end_date,
            "transactions",
            "total_transactions",
            Some(serde_json::json!({
                "include_personal_finance_category": true,
                "include_original_description": true,
            })),
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, NaiveDate, Utc};
    use plaid::model::Products;

    use crate::synced::plaid::new_plaid_client;

    /// Helper to retry transactions fetch with exponential backoff for PRODUCT_NOT_READY errors.
    /// Plaid sandbox items need time for products to initialize after creation.
    async fn get_transactions_with_retry(
        client: &super::PlaidClient,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> crate::error::Result<Vec<serde_json::Value>> {
        let max_retries = 5;
        let mut delay_ms = 500;

        for attempt in 1..=max_retries {
            match client.get_transactions(start_date, end_date).await {
                Ok(transactions) => return Ok(transactions),
                Err(e) if e.to_string().contains("PRODUCT_NOT_READY") && attempt < max_retries => {
                    println!(
                        "PRODUCT_NOT_READY on attempt {}/{}, retrying in {}ms...",
                        attempt, max_retries, delay_ms
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                    delay_ms *= 2; // exponential backoff
                }
                Err(e) => return Err(e),
            }
        }

        unreachable!()
    }

    #[tokio::test]
    async fn test_get_transactions() {
        let client = new_plaid_client(true, vec![Products::Transactions]).await;
        let end_date = Utc::now().date_naive();
        let start_date = end_date - Duration::days(30);
        let transactions = get_transactions_with_retry(&client, start_date, end_date)
            .await
            .expect("Failed to get transactions after retries");

        println!("Found {} transactions", transactions.len());

        assert!(!transactions.is_empty());
    }

    #[tokio::test]
    async fn test_transactions_empty_range() {
        let client = new_plaid_client(true, vec![Products::Transactions]).await;
        let end_date = NaiveDate::from_ymd_opt(2020, 1, 1).expect("valid date");
        let start_date = NaiveDate::from_ymd_opt(2019, 12, 1).expect("valid date");
        let transactions = get_transactions_with_retry(&client, start_date, end_date)
            .await
            .expect("Failed to get transactions after retries");

        assert!(transactions.is_empty());
    }

    #[tokio::test]
    async fn test_transactions_requires_access_token() {
        let client = new_plaid_client(false, vec![Products::Transactions]).await;
        let end_date = Utc::now().date_naive();
        let start_date = end_date - Duration::days(30);
        let result = client.get_transactions(start_date, end_date).await;

        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Access token not set")
        );
    }
}
