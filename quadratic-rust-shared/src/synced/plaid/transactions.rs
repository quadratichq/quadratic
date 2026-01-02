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

    #[tokio::test]
    async fn test_get_transactions() {
        let client = new_plaid_client(true, vec![Products::Transactions]).await;
        let end_date = Utc::now().date_naive();
        let start_date = end_date - Duration::days(30);
        let transactions = client.get_transactions(start_date, end_date).await.unwrap();

        println!("Found {} transactions", transactions.len());

        assert!(!transactions.is_empty());
    }

    #[tokio::test]
    async fn test_transactions_empty_range() {
        let client = new_plaid_client(true, vec![Products::Transactions]).await;
        let end_date = NaiveDate::from_ymd_opt(2020, 1, 1).unwrap();
        let start_date = NaiveDate::from_ymd_opt(2019, 12, 1).unwrap();
        let transactions = client.get_transactions(start_date, end_date).await.unwrap();

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
