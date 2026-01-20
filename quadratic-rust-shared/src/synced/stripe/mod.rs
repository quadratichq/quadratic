//! Stripe Synced Connection
//!
//! This module contains the logic for syncing Stripe connections.
//! Stripe connections sync customer, charge, invoice, and subscription data.

use async_trait::async_trait;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::environment::Environment;
use crate::error::Result;
use crate::synced::stripe::client::StripeClient;
use crate::synced::{DATE_FORMAT, SyncedClient, SyncedConnection, SyncedConnectionKind};

pub mod charges;
pub mod client;
pub mod customers;
pub mod invoices;
pub mod subscriptions;

/// Stripe connection configuration stored in the database.
#[derive(Debug, Deserialize, Serialize)]
pub struct StripeConnection {
    /// The Stripe API secret key (sk_live_... or sk_test_...)
    pub api_key: String,
    /// Optional: The start date for syncing historical data (YYYY-MM-DD format)
    pub start_date: String,
}

#[async_trait]
impl SyncedConnection for StripeConnection {
    fn name(&self) -> &str {
        "STRIPE"
    }

    fn kind(&self) -> SyncedConnectionKind {
        SyncedConnectionKind::Stripe
    }

    fn start_date(&self) -> NaiveDate {
        NaiveDate::parse_from_str(&self.start_date, DATE_FORMAT).unwrap()
    }

    fn streams(&self) -> Vec<&'static str> {
        StripeClient::streams()
    }

    async fn to_client(&self, _environment: Environment) -> Result<Box<dyn SyncedClient>> {
        let client = StripeClient::new(&self.api_key);

        Ok(Box::new(client))
    }
}
