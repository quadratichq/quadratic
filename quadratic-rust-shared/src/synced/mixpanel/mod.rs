pub mod annotations;
pub mod client;
pub mod cohorts;
pub mod engage;
pub mod events;
pub mod funnel;
pub mod revenue;

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
