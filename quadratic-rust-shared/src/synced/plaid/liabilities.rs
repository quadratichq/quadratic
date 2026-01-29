use serde_json::Value;

use crate::error::Result;
use crate::synced::plaid::client::PlaidClient;

impl PlaidClient {
    /// Get liabilities data using /liabilities/get
    ///
    /// Returns a point-in-time snapshot of credit cards, mortgages, and student loans.
    pub async fn get_liabilities(&self) -> Result<Value> {
        self.fetch_object("liabilities/get", "liabilities").await
    }
}

#[cfg(test)]
mod tests {
    use crate::synced::plaid::new_plaid_client;
    use plaid::model::Products;

    #[tokio::test]
    async fn test_get_liabilities() {
        let client = new_plaid_client(true, vec![Products::Liabilities]).await;
        let liabilities = client.get_liabilities().await.unwrap();

        println!("Liabilities: {}", liabilities);
    }

    #[tokio::test]
    async fn test_liabilities_requires_access_token() {
        let client = new_plaid_client(false, vec![Products::Liabilities]).await;
        let result = client.get_liabilities().await;

        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Access token not set")
        );
    }
}
