//! Stripe Charges Export
//!
//! This module handles exporting Stripe charge data.

use async_stripe::{Charge, ListCharges};
use bytes::Bytes;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

use crate::parquet::json::grouped_json_to_parquet;
use crate::synced::stripe::client::StripeClient;
use crate::synced::DATE_FORMAT;
use crate::{SharedError, error::Result};

/// Flattened charge record for parquet storage
#[derive(Debug, Serialize, Deserialize)]
pub struct FlattenedCharge {
    pub id: String,
    pub amount: i64,
    pub amount_captured: i64,
    pub amount_refunded: i64,
    pub currency: String,
    pub customer: Option<String>,
    pub description: Option<String>,
    pub created: i64,
    pub paid: bool,
    pub refunded: bool,
    pub status: String,
    pub captured: bool,
    pub disputed: bool,
    pub failure_code: Option<String>,
    pub failure_message: Option<String>,
    pub invoice: Option<String>,
    pub payment_intent: Option<String>,
    pub receipt_email: Option<String>,
    pub receipt_url: Option<String>,
    pub livemode: bool,
}

impl StripeClient {
    /// List charges with pagination
    pub async fn list_charges_page(
        &self,
        starting_after: Option<&str>,
        limit: Option<i64>,
        created_gte: Option<i64>,
        created_lte: Option<i64>,
    ) -> Result<Vec<Charge>> {
        let mut params = ListCharges::default();
        params.limit = limit.map(|l| l as u64);
        if let Some(cursor) = starting_after {
            params.starting_after = Some(cursor.to_string());
        }

        // Use created filter for efficient date range queries
        if let Some(gte) = created_gte {
            params.created = Some(async_stripe::RangeQuery {
                gte: Some(gte),
                gt: None,
                lte: created_lte,
                lt: None,
            });
        }

        let charges = Charge::list(self.client(), &params)
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to list charges: {}", e)))?;

        Ok(charges.data)
    }

    /// Export charges within a date range
    pub async fn export_charges(
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
            let charges = self
                .list_charges_page(
                    starting_after.as_deref(),
                    Some(page_size),
                    Some(start_timestamp),
                    Some(end_timestamp),
                )
                .await?;

            if charges.is_empty() {
                break;
            }

            let last_id = charges.last().map(|c| c.id.to_string());

            for charge in charges {
                let created = charge.created.unwrap_or(0);

                let datetime = DateTime::<Utc>::from_timestamp(created, 0)
                    .ok_or_else(|| SharedError::Synced("Invalid timestamp".to_string()))?;
                let date_key = datetime.format(DATE_FORMAT).to_string();

                let flattened = Self::flatten_charge(&charge);
                let flattened_json = serde_json::to_string(&flattened)?;

                grouped_json
                    .lock()?
                    .entry(date_key)
                    .or_default()
                    .push(flattened_json);
            }

            starting_after = last_id;

            if starting_after.is_none() {
                break;
            }
        }

        let grouped_json = grouped_json.into_inner()?;

        if grouped_json.is_empty() {
            return Ok(HashMap::new());
        }

        let grouped_parquet = grouped_json_to_parquet(grouped_json)?;

        Ok(grouped_parquet)
    }

    /// Flatten a Stripe charge into a simple record
    fn flatten_charge(charge: &Charge) -> FlattenedCharge {
        FlattenedCharge {
            id: charge.id.to_string(),
            amount: charge.amount.unwrap_or(0),
            amount_captured: charge.amount_captured.unwrap_or(0),
            amount_refunded: charge.amount_refunded.unwrap_or(0),
            currency: charge.currency.map(|c| c.to_string()).unwrap_or_default(),
            customer: charge.customer.as_ref().map(|c| match c {
                async_stripe::Expandable::Id(id) => id.to_string(),
                async_stripe::Expandable::Object(obj) => obj.id.to_string(),
            }),
            description: charge.description.clone(),
            created: charge.created.unwrap_or(0),
            paid: charge.paid.unwrap_or(false),
            refunded: charge.refunded.unwrap_or(false),
            status: charge
                .status
                .map(|s| format!("{:?}", s))
                .unwrap_or_default(),
            captured: charge.captured.unwrap_or(false),
            disputed: charge.disputed.unwrap_or(false),
            failure_code: charge.failure_code.clone(),
            failure_message: charge.failure_message.clone(),
            invoice: charge.invoice.as_ref().map(|i| match i {
                async_stripe::Expandable::Id(id) => id.to_string(),
                async_stripe::Expandable::Object(obj) => obj.id.to_string(),
            }),
            payment_intent: charge.payment_intent.as_ref().map(|p| match p {
                async_stripe::Expandable::Id(id) => id.to_string(),
                async_stripe::Expandable::Object(obj) => obj.id.to_string(),
            }),
            receipt_email: charge.receipt_email.clone(),
            receipt_url: charge.receipt_url.clone(),
            livemode: charge.livemode.unwrap_or(false),
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
    async fn test_export_charges() {
        let client = new_stripe_client();
        let today = chrono::Utc::now().date_naive();
        let start_date = today - chrono::Duration::days(30);

        let result = client.export_charges(start_date, today).await;
        assert!(result.is_ok());
    }
}
