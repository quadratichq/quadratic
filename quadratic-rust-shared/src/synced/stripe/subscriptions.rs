//! Stripe Subscriptions Export
//!
//! This module handles exporting Stripe subscription data.

use async_stripe::{ListSubscriptions, Subscription};
use bytes::Bytes;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

use crate::parquet::json::grouped_json_to_parquet;
use crate::synced::stripe::client::StripeClient;
use crate::synced::DATE_FORMAT;
use crate::{SharedError, error::Result};

/// Flattened subscription record for parquet storage
#[derive(Debug, Serialize, Deserialize)]
pub struct FlattenedSubscription {
    pub id: String,
    pub customer: String,
    pub status: String,
    pub created: i64,
    pub current_period_start: i64,
    pub current_period_end: i64,
    pub start_date: i64,
    pub ended_at: Option<i64>,
    pub canceled_at: Option<i64>,
    pub cancel_at: Option<i64>,
    pub cancel_at_period_end: bool,
    pub currency: String,
    pub collection_method: Option<String>,
    pub default_payment_method: Option<String>,
    pub latest_invoice: Option<String>,
    pub trial_start: Option<i64>,
    pub trial_end: Option<i64>,
    pub livemode: bool,
}

impl StripeClient {
    /// List subscriptions with pagination
    pub async fn list_subscriptions_page(
        &self,
        starting_after: Option<&str>,
        limit: Option<i64>,
        created_gte: Option<i64>,
        created_lte: Option<i64>,
    ) -> Result<Vec<Subscription>> {
        let mut params = ListSubscriptions::default();
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

        let subscriptions = Subscription::list(self.client(), &params)
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to list subscriptions: {}", e)))?;

        Ok(subscriptions.data)
    }

    /// Export subscriptions within a date range
    pub async fn export_subscriptions(
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
            let subscriptions = self
                .list_subscriptions_page(
                    starting_after.as_deref(),
                    Some(page_size),
                    Some(start_timestamp),
                    Some(end_timestamp),
                )
                .await?;

            if subscriptions.is_empty() {
                break;
            }

            let last_id = subscriptions.last().map(|s| s.id.to_string());

            for subscription in subscriptions {
                let created = subscription.created.unwrap_or(0);

                let datetime = DateTime::<Utc>::from_timestamp(created, 0)
                    .ok_or_else(|| SharedError::Synced("Invalid timestamp".to_string()))?;
                let date_key = datetime.format(DATE_FORMAT).to_string();

                let flattened = Self::flatten_subscription(&subscription);
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

    /// Flatten a Stripe subscription into a simple record
    fn flatten_subscription(subscription: &Subscription) -> FlattenedSubscription {
        FlattenedSubscription {
            id: subscription.id.to_string(),
            customer: match &subscription.customer {
                async_stripe::Expandable::Id(id) => id.to_string(),
                async_stripe::Expandable::Object(obj) => obj.id.to_string(),
            },
            status: format!("{:?}", subscription.status),
            created: subscription.created.unwrap_or(0),
            current_period_start: subscription.current_period_start.unwrap_or(0),
            current_period_end: subscription.current_period_end.unwrap_or(0),
            start_date: subscription.start_date.unwrap_or(0),
            ended_at: subscription.ended_at,
            canceled_at: subscription.canceled_at,
            cancel_at: subscription.cancel_at,
            cancel_at_period_end: subscription.cancel_at_period_end.unwrap_or(false),
            currency: subscription
                .currency
                .map(|c| c.to_string())
                .unwrap_or_default(),
            collection_method: subscription.collection_method.map(|m| format!("{:?}", m)),
            default_payment_method: subscription.default_payment_method.as_ref().map(|p| match p {
                async_stripe::Expandable::Id(id) => id.to_string(),
                async_stripe::Expandable::Object(obj) => obj.id.to_string(),
            }),
            latest_invoice: subscription.latest_invoice.as_ref().map(|i| match i {
                async_stripe::Expandable::Id(id) => id.to_string(),
                async_stripe::Expandable::Object(obj) => obj.id.to_string(),
            }),
            trial_start: subscription.trial_start,
            trial_end: subscription.trial_end,
            livemode: subscription.livemode.unwrap_or(false),
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
    async fn test_export_subscriptions() {
        let client = new_stripe_client();
        let today = chrono::Utc::now().date_naive();
        let start_date = today - chrono::Duration::days(30);

        let result = client.export_subscriptions(start_date, today).await;
        assert!(result.is_ok());
    }
}
