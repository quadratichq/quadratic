use serde_json::Value;

use crate::error::Result;
use crate::synced::plaid::client::PlaidClient;

impl PlaidClient {
    /// Get account balances using /accounts/balance/get
    ///
    /// Returns a point-in-time snapshot of balances for all linked accounts.
    /// This includes available balance, current balance, and credit limits.
    pub async fn get_balances(&self) -> Result<Value> {
        self.fetch_object("accounts/balance/get", "accounts").await
    }
}

#[cfg(test)]
mod tests {
    use crate::synced::plaid::new_plaid_client;
    use plaid::model::Products;

    #[tokio::test]
    async fn test_get_balances() {
        // Balance product is typically bundled with Transactions
        let client = new_plaid_client(true, vec![Products::Transactions]).await;
        let balances = client.get_balances().await.unwrap();

        println!("Balances: {}", balances);

        // Should return an array of accounts
        assert!(balances.is_array());
        assert!(!balances.as_array().unwrap().is_empty());
    }
}
