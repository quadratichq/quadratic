use async_trait::async_trait;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::synced::mixpanel::client::MixpanelClient;
use crate::synced::{DATE_FORMAT, SyncedClient, SyncedConnection, SyncedConnectionKind};

pub mod annotations;
pub mod client;
pub mod cohorts;
pub mod engage;
pub mod events;
pub mod funnel;
pub mod revenue;

#[derive(Debug, Deserialize, Serialize)]
pub struct MixpanelConnection {
    pub api_secret: String,
    pub project_id: String,
    pub start_date: String,
}

#[async_trait]
impl SyncedConnection for MixpanelConnection {
    fn name(&self) -> &str {
        "MIXPANEL"
    }

    fn kind(&self) -> SyncedConnectionKind {
        SyncedConnectionKind::Mixpanel
    }

    fn start_date(&self) -> NaiveDate {
        NaiveDate::parse_from_str(&self.start_date, DATE_FORMAT).unwrap()
    }

    fn streams(&self) -> Vec<&'static str> {
        MixpanelClient::streams()
    }

    async fn to_client(&self) -> Result<Box<dyn SyncedClient>> {
        let client = MixpanelClient::new(&self.api_secret, &self.project_id);

        Ok(Box::new(client))
    }
}

#[derive(Debug, Clone)]
pub enum MixpanelServer {
    US,
    EU,
    India,
}

impl MixpanelServer {
    pub fn base_url(&self) -> &'static str {
        match self {
            MixpanelServer::US => "https://mixpanel.com/api/2.0",
            MixpanelServer::EU => "https://eu.mixpanel.com/api/2.0",
            MixpanelServer::India => "https://in.mixpanel.com/api/2.0",
        }
    }

    pub fn data_export_url(&self) -> &'static str {
        match self {
            MixpanelServer::US => "https://data.mixpanel.com/api/2.0",
            MixpanelServer::EU => "https://data-eu.mixpanel.com/api/2.0",
            MixpanelServer::India => "https://data-in.mixpanel.com/api/2.0",
        }
    }
}
