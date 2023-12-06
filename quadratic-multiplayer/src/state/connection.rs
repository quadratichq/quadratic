use anyhow::{anyhow, Result};
use uuid::Uuid;

use crate::state::State;

impl State {
    pub(crate) async fn get_connection_id(&self, connection_id: Uuid) -> Result<Uuid> {
        let connection_id = self
            .connections
            .lock()
            .await
            .get(&connection_id)
            .ok_or(anyhow!("connection_id {} not found", connection_id))?
            .to_owned();

        Ok(connection_id)
    }

    ///
    pub(crate) async fn clear_connections(&self, connection_id: Uuid) -> Result<Vec<Uuid>> {
        let mut affected_rooms = vec![];
        let connection_id = self.get_connection_id(connection_id).await?;
        let rooms = self.rooms.lock().await.clone();

        for (file_id, room) in rooms.iter() {
            if let Some(user) = room.users.get(&connection_id) {
                tracing::info!("Removing connection_id {connection_id} from room {file_id}");

                self.leave_room(room.file_id, &user.session_id).await?;
                affected_rooms.push(file_id.to_owned());
            }
        }

        tracing::info!("Removing connection_id {}", connection_id);

        self.connections.lock().await.remove(&connection_id);
        Ok(affected_rooms)
    }
}
