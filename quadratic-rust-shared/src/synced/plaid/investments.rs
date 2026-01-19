use chrono::NaiveDate;
use serde_json::Value;

use crate::error::Result;
use crate::synced::plaid::client::PlaidClient;

impl PlaidClient {
    /// Get investment transactions for a specific date range using /investments/transactions/get
    pub async fn get_investment_transactions(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<Vec<Value>> {
        self.fetch_paginated_array(
            "investments/transactions/get",
            start_date,
            end_date,
            "investment_transactions",
            "total_investment_transactions",
            None,
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, NaiveDate, Utc};

    use crate::synced::plaid::new_plaid_client;
    use plaid::model::Products;

    #[tokio::test]
    async fn test_get_investment_transactions() {
        let client = new_plaid_client(true, vec![Products::Investments]).await;
        let end_date = Utc::now().date_naive();
        let start_date = end_date - Duration::days(30);
        let transactions = client
            .get_investment_transactions(start_date, end_date)
            .await
            .unwrap();

        println!("Found {} investment transactions", transactions.len());

        assert!(!transactions.is_empty());
    }

    #[tokio::test]
    async fn test_investment_transactions_empty_range() {
        let client = new_plaid_client(true, vec![Products::Investments]).await;
        let end_date = NaiveDate::from_ymd_opt(2020, 1, 1).unwrap();
        let start_date = NaiveDate::from_ymd_opt(2019, 12, 1).unwrap();
        let transactions = client
            .get_investment_transactions(start_date, end_date)
            .await
            .unwrap();

        assert!(transactions.is_empty());
    }

    #[tokio::test]
    async fn test_investment_transactions_requires_access_token() {
        let client = new_plaid_client(false, vec![Products::Investments]).await;
        let end_date = Utc::now().date_naive();
        let start_date = end_date - Duration::days(30);
        let result = client
            .get_investment_transactions(start_date, end_date)
            .await;

        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Access token not set")
        );
    }
}
