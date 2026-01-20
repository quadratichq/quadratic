//! Stripe Customers Export
//!
//! This module handles exporting Stripe customer data.

use async_stripe::Customer;
use async_stripe::ListCustomers;
use bytes::Bytes;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

use crate::parquet::json::grouped_json_to_parquet;
use crate::synced::stripe::client::StripeClient;
use crate::synced::DATE_FORMAT;
use crate::{SharedError, error::Result};

/// Flattened customer record for parquet storage
#[derive(Debug, Serialize, Deserialize)]
pub struct FlattenedCustomer {
    pub id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub phone: Option<String>,
    pub description: Option<String>,
    pub created: i64,
    pub currency: Option<String>,
    pub default_source: Option<String>,
    pub delinquent: Option<bool>,
    pub balance: Option<i64>,
    pub livemode: bool,
}

impl StripeClient {
    /// List customers with pagination
    pub async fn list_customers_page(
        &self,
        starting_after: Option<&str>,
        limit: Option<i64>,
    ) -> Result<Vec<Customer>> {
        let mut params = ListCustomers::default();
        params.limit = limit.map(|l| l as u64);
        if let Some(cursor) = starting_after {
            params.starting_after = Some(cursor.to_string());
        }

        let customers = Customer::list(self.client(), &params)
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to list customers: {}", e)))?;

        Ok(customers.data)
    }

    /// Export customers within a date range
    pub async fn export_customers(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
    ) -> Result<HashMap<String, Bytes>> {
        let start_timestamp = start_date
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp();
        let end_timestamp = end_date
            .and_hms_opt(23, 59, 59)
            .unwrap()
            .and_utc()
            .timestamp();

        let grouped_json = Mutex::new(HashMap::<String, Vec<String>>::new());
        let mut starting_after: Option<String> = None;
        let page_size = 100i64;

        loop {
            let customers = self
                .list_customers_page(starting_after.as_deref(), Some(page_size))
                .await?;

            if customers.is_empty() {
                break;
            }

            let last_id = customers.last().map(|c| c.id.to_string());

            for customer in customers {
                let created = customer.created.unwrap_or(0);

                // Filter by date range
                if created < start_timestamp {
                    // Customers are returned newest first, so if we've gone past start_date, stop
                    starting_after = None;
                    break;
                }

                if created > end_timestamp {
                    // Skip customers created after end_date
                    continue;
                }

                let datetime = DateTime::<Utc>::from_timestamp(created, 0)
                    .ok_or_else(|| SharedError::Synced("Invalid timestamp".to_string()))?;
                let date_key = datetime.format(DATE_FORMAT).to_string();

                let flattened = Self::flatten_customer(&customer);
                let flattened_json = serde_json::to_string(&flattened)?;

                grouped_json
                    .lock()?
                    .entry(date_key)
                    .or_default()
                    .push(flattened_json);
            }

            // Check if we should continue pagination
            match (starting_after.take(), last_id) {
                (None, _) => break,
                (_, Some(id)) => starting_after = Some(id),
                (_, None) => break,
            }
        }

        let grouped_json = grouped_json.into_inner()?;

        if grouped_json.is_empty() {
            return Ok(HashMap::new());
        }

        let grouped_parquet = grouped_json_to_parquet(grouped_json)?;

        Ok(grouped_parquet)
    }

    /// Flatten a Stripe customer into a simple record
    fn flatten_customer(customer: &Customer) -> FlattenedCustomer {
        FlattenedCustomer {
            id: customer.id.to_string(),
            email: customer.email.clone(),
            name: customer.name.clone(),
            phone: customer.phone.clone(),
            description: customer.description.clone(),
            created: customer.created.unwrap_or(0),
            currency: customer.currency.map(|c| c.to_string()),
            default_source: customer.default_source.as_ref().map(|s| match s {
                async_stripe::PaymentSource::Card(card) => card.id.to_string(),
                async_stripe::PaymentSource::Source(source) => source.id.to_string(),
                async_stripe::PaymentSource::Account(account) => account.id.to_string(),
                async_stripe::PaymentSource::BankAccount(bank) => bank.id.to_string(),
            }),
            delinquent: customer.delinquent,
            balance: customer.balance,
            livemode: customer.livemode.unwrap_or(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::synced::stripe::client::new_stripe_client;

    // Integration test - requires real credentials
    #[ignore]
    #[tokio::test]
    async fn test_export_customers() {
        let client = new_stripe_client();
        let today = chrono::Utc::now().date_naive();
        let start_date = today - chrono::Duration::days(30);

        let result = client.export_customers(start_date, today).await;
        assert!(result.is_ok());
    }
}
