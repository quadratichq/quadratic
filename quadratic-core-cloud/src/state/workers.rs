use quadratic_core::controller::GridController;
use quadratic_rust_shared::quadratic_api::get_file_checkpoint;
use uuid::Uuid;

use crate::error::Result;
use crate::get_worker;
use crate::state::State;
use crate::worker::Worker;

impl State {
    /// Retrieves a copy of a worker.
    pub(crate) async fn get_worker(&self, file_id: &Uuid) -> Result<Worker> {
        let worker = get_worker!(self, file_id)?.clone();

        Ok(worker)
    }

    /// Add a worker.  If the worker doesn't exist, it is created.
    /// Returns true if the worker was newly added.
    #[tracing::instrument(level = "trace")]
    pub(crate) async fn create_worker(&self, file_id: Uuid, sequence_num: u64) -> Result<bool> {
        let sequence_num = self.get_max_sequence_num(file_id, sequence_num).await?;
        let workers = self.workers.lock().await;

        if workers.contains_key(&file_id) {
            return Ok(false);
        }
        let worker = Worker::new(file_id, sequence_num, &self.settings.storage).await?;
        workers.insert(file_id, worker);

        tracing::info!(
            "Worker {} created with sequence_num {}",
            file_id,
            sequence_num
        );

        Ok(true)
    }

    /// Removes a worker.
    /// Returns the number of workers left.
    #[tracing::instrument(level = "trace")]
    pub(crate) async fn destroy_worker(&self, file_id: Uuid) -> Result<usize> {
        let workers = self.workers.lock().await;
        let worker = workers.remove(&file_id);
        let num_workers = workers.len();

        tracing::info!(
            "Worker {:?} is being destroyed, {} workers(s) left",
            worker,
            num_workers
        );

        if num_workers == 0 {
            tracing::info!("No workers alive");
        }

        Ok(num_workers)
    }

    /// Get a worker's current sequence number.
    pub(crate) async fn get_sequence_num(&self, file_id: &Uuid) -> Result<u64> {
        Ok(get_worker!(self, file_id)?.sequence_num)
    }

    /// Get the maximum sequence number for a worker.
    /// If the worker doesn't exist in memory, get the latest checkpoint from
    /// quadratic api.
    pub(crate) async fn get_max_sequence_num(
        &self,
        file_id: Uuid,
        sequence_num: u64,
    ) -> Result<u64> {
        let sequence_num: u64 = match get_worker!(self, file_id) {
            Ok(worker) => worker.sequence_num.max(sequence_num),
            Err(_) => {
                if cfg!(test) {
                    0
                } else {
                    let url = &self.settings.quadratic_api_uri;
                    let jwt = &self.settings.m2m_auth_token;
                    let response = get_file_checkpoint(url, jwt, &file_id)
                        .await?
                        .sequence_number
                        .max(sequence_num);

                    tracing::info!(
                        "Retrieved sequence number {} for worker {}",
                        response,
                        file_id
                    );
                    response
                }
            }
        };

        Ok(sequence_num)
    }
}

#[macro_export]
macro_rules! get_worker {
    ( $self:ident, $file_id:ident ) => {
        $self.workers.lock().await.get(&$file_id).ok_or(
            $crate::error::CoreCloudError::WorkerNotFound($file_id.to_string()),
        )
    };
}

#[macro_export]
macro_rules! get_mut_worker {
    ( $self:ident, $file_id:ident ) => {
        $self.workers.lock().await.get_mut(&$file_id).ok_or(
            $crate::error::CoreCloudError::WorkerNotFound($file_id.to_string()),
        )
    };
}

#[cfg(test)]
mod tests {
    use crate::test_util::new_state;

    use super::*;

    #[tokio::test]
    async fn create_and_destroy_workers() {
        let state = new_state().await;
        let file_id_1 = Uuid::new_v4();
        let file_id_2 = Uuid::new_v4();

        let is_new = state.create_worker(file_id_1, 0).await.unwrap();
        let worker = state.get_worker(&file_id_1).await.unwrap();

        assert!(is_new);
        assert_eq!(state.workers.lock().await.len(), 1);
        assert_eq!(worker.sequence_num, 0);

        let sequence_num = state.get_sequence_num(&file_id_1).await.unwrap();
        assert_eq!(sequence_num, 0);

        get_mut_worker!(state, file_id_1)
            .unwrap()
            .increment_sequence_num();
        let sequence_num = state.get_sequence_num(&file_id_1).await.unwrap();
        assert_eq!(sequence_num, 1);

        // create a second worker
        state.create_worker(file_id_2, 1).await.unwrap();
        assert_eq!(state.workers.lock().await.len(), 2);

        // destroy the first worker
        state.destroy_worker(file_id_1).await.unwrap();
        assert_eq!(state.workers.lock().await.len(), 1);

        // get the second worker
        let worker = state.get_worker(&file_id_2).await.unwrap();
        assert_eq!(worker.sequence_num, 1);

        // expect an error
        let worker = state.get_worker(&file_id_1).await;
        assert!(worker.is_err());
    }
}
