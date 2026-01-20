//! Stripe Invoices Export
//!
//! This module handles exporting Stripe invoice data.

use async_stripe::{Invoice, ListInvoices};
use bytes::Bytes;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

use crate::parquet::json::grouped_json_to_parquet;
use crate::synced::stripe::client::StripeClient;
use crate::synced::DATE_FORMAT;
use crate::{SharedError, error::Result};

/// Flattened invoice record for parquet storage
#[derive(Debug, Serialize, Deserialize)]
pub struct FlattenedInvoice {
    pub id: String,
    pub customer: Option<String>,
    pub customer_email: Option<String>,
    pub customer_name: Option<String>,
    pub amount_due: i64,
    pub amount_paid: i64,
    pub amount_remaining: i64,
    pub currency: String,
    pub created: i64,
    pub due_date: Option<i64>,
    pub paid: bool,
    pub status: Option<String>,
    pub subscription: Option<String>,
    pub total: i64,
    pub subtotal: i64,
    pub tax: Option<i64>,
    pub number: Option<String>,
    pub invoice_pdf: Option<String>,
    pub hosted_invoice_url: Option<String>,
    pub period_start: i64,
    pub period_end: i64,
    pub attempt_count: u64,
    pub attempted: bool,
    pub livemode: bool,
}

impl StripeClient {
    /// List invoices with pagination
    pub async fn list_invoices_page(
        &self,
        starting_after: Option<&str>,
        limit: Option<i64>,
        created_gte: Option<i64>,
        created_lte: Option<i64>,
    ) -> Result<Vec<Invoice>> {
        let mut params = ListInvoices::default();
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

        let invoices = Invoice::list(self.client(), &params)
            .await
            .map_err(|e| SharedError::Synced(format!("Failed to list invoices: {}", e)))?;

        Ok(invoices.data)
    }

    /// Export invoices within a date range
    pub async fn export_invoices(
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
            let invoices = self
                .list_invoices_page(
                    starting_after.as_deref(),
                    Some(page_size),
                    Some(start_timestamp),
                    Some(end_timestamp),
                )
                .await?;

            if invoices.is_empty() {
                break;
            }

            let last_id = invoices.last().map(|i| i.id.to_string());

            for invoice in invoices {
                let created = invoice.created.unwrap_or(0);

                let datetime = DateTime::<Utc>::from_timestamp(created, 0)
                    .ok_or_else(|| SharedError::Synced("Invalid timestamp".to_string()))?;
                let date_key = datetime.format(DATE_FORMAT).to_string();

                let flattened = Self::flatten_invoice(&invoice);
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

    /// Flatten a Stripe invoice into a simple record
    fn flatten_invoice(invoice: &Invoice) -> FlattenedInvoice {
        FlattenedInvoice {
            id: invoice.id.to_string(),
            customer: invoice.customer.as_ref().map(|c| match c {
                async_stripe::Expandable::Id(id) => id.to_string(),
                async_stripe::Expandable::Object(obj) => obj.id.to_string(),
            }),
            customer_email: invoice.customer_email.clone(),
            customer_name: invoice.customer_name.clone(),
            amount_due: invoice.amount_due.unwrap_or(0),
            amount_paid: invoice.amount_paid.unwrap_or(0),
            amount_remaining: invoice.amount_remaining.unwrap_or(0),
            currency: invoice.currency.map(|c| c.to_string()).unwrap_or_default(),
            created: invoice.created.unwrap_or(0),
            due_date: invoice.due_date,
            paid: invoice.paid.unwrap_or(false),
            status: invoice.status.map(|s| format!("{:?}", s)),
            subscription: invoice.subscription.as_ref().map(|s| match s {
                async_stripe::Expandable::Id(id) => id.to_string(),
                async_stripe::Expandable::Object(obj) => obj.id.to_string(),
            }),
            total: invoice.total.unwrap_or(0),
            subtotal: invoice.subtotal.unwrap_or(0),
            tax: invoice.tax,
            number: invoice.number.clone(),
            invoice_pdf: invoice.invoice_pdf.clone(),
            hosted_invoice_url: invoice.hosted_invoice_url.clone(),
            period_start: invoice.period_start.unwrap_or(0),
            period_end: invoice.period_end.unwrap_or(0),
            attempt_count: invoice.attempt_count.unwrap_or(0),
            attempted: invoice.attempted.unwrap_or(false),
            livemode: invoice.livemode.unwrap_or(false),
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
    async fn test_export_invoices() {
        let client = new_stripe_client();
        let today = chrono::Utc::now().date_naive();
        let start_date = today - chrono::Duration::days(30);

        let result = client.export_invoices(start_date, today).await;
        assert!(result.is_ok());
    }
}
