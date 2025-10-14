use uuid::Uuid;

use crate::state::State;

impl State {
    pub(crate) async fn acquire_worker_create_lock(&self, file_id: &Uuid) -> bool {
        self.creating_workers.lock().await.insert(*file_id)
    }

    pub(crate) async fn release_worker_create_lock(&self, file_id: &Uuid) {
        self.creating_workers.lock().await.remove(file_id);
    }
}
