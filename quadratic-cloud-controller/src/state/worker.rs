use uuid::Uuid;

use crate::{
    error::{ControllerError, Result},
    state::State,
};

impl State {
    pub(crate) async fn generate_worker_ephemeral_token(&self, file_id: &Uuid) -> Uuid {
        let token = Uuid::new_v4();
        self.worker_ephemeral_tokens
            .lock()
            .await
            .insert(*file_id, token);
        token
    }

    pub(crate) async fn verify_worker_ephemeral_token(
        &self,
        file_id: Uuid,
        worker_ephemeral_token: Uuid,
    ) -> Result<Uuid> {
        let stored_worker_ephemeral_token = self
            .worker_ephemeral_tokens
            .lock()
            .await
            .get(&file_id)
            .cloned();

        let tokens_match = stored_worker_ephemeral_token == Some(worker_ephemeral_token);

        if !tokens_match {
            return Err(ControllerError::WorkerEphemeralToken(format!(
                "Invalid worker ephemeral token for file {file_id}"
            )));
        }

        Ok(file_id)
    }

    pub(crate) async fn remove_worker_ephemeral_token(&self, file_id: &Uuid) {
        self.worker_ephemeral_tokens.lock().await.remove(file_id);
    }

    pub(crate) async fn acquire_worker_create_lock(&self, file_id: &Uuid) -> bool {
        self.creating_workers.lock().await.insert(*file_id)
    }

    pub(crate) async fn release_worker_create_lock(&self, file_id: &Uuid) {
        self.creating_workers.lock().await.remove(file_id);
    }
}
