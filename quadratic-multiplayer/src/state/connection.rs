use anyhow::{anyhow, Result};
use uuid::Uuid;

use crate::state::State;

impl State {
    pub(crate) async fn get_session_id(&self, socket_id: Uuid) -> Result<Uuid> {
        let session_id = self
            .connections
            .lock()
            .await
            .get(&socket_id)
            .ok_or(anyhow!("socket_id {} not found in sockets", socket_id))?
            .to_owned();

        Ok(session_id)
    }

    /// Removes a connection from the state.  If the connection is in a room, leave the room.
    pub(crate) async fn clear_connections(&self, connection_id: Uuid) -> Result<Vec<Uuid>> {
        let mut affected_rooms = vec![];
        let rooms = self.rooms.lock().await.clone();

        for (file_id, room) in rooms.iter() {
            let session_id = self.get_session_id(connection_id).await?;
            if let Some(user) = room.users.get(&session_id) {
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
