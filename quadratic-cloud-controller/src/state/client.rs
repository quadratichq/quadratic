#[cfg(feature = "kubernetes")]
use kube::client::Client as KubeClient;
#[cfg(feature = "docker")]
use quadratic_rust_shared::docker::cluster::Cluster;

use crate::{
    error::{ControllerError, Result},
    state::State,
};

impl State {
    #[cfg(feature = "docker")]
    pub(crate) async fn init_client() -> Result<Cluster> {
        let client = Cluster::try_new()
            .await
            .map_err(|e| ControllerError::Client(e.to_string()))?;

        Ok(client)
    }

    #[cfg(feature = "kubernetes")]
    pub(crate) async fn init_client() -> Result<KubeClient> {
        let mut kube_config = kube::Config::infer()
            .await
            .map_err(|e| ControllerError::Client(e.to_string()))?;
        kube_config.connect_timeout = Some(std::time::Duration::from_secs(30));
        kube_config.read_timeout = Some(std::time::Duration::from_secs(30));
        let client = KubeClient::try_from(kube_config)
            .map_err(|e| ControllerError::Client(e.to_string()))?;

        Ok(client)
    }

    #[cfg(feature = "kubernetes")]
    fn get_client(&self) -> &KubeClient {
        &self.client
    }
}
