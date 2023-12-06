use anyhow::{anyhow, Result};

use uuid::Uuid;

use crate::state::State;

impl State {
    pub(crate) async fn get_socket_id(&self, socket_id: Uuid) -> Result<Uuid> {
        let session_id = self
            .sockets
            .lock()
            .await
            .get(&socket_id)
            .ok_or(anyhow!("socket_id {} not found", socket_id))?
            .to_owned();

        Ok(session_id)
    }

    ///
    pub(crate) async fn clear_sockets(&self, socket_id: Uuid) -> Result<Vec<Uuid>> {
        let mut affected_rooms = vec![];
        let session_id = self.get_socket_id(socket_id).await?;
        let rooms = self.rooms.lock().await.clone();

        for (file_id, room) in rooms.iter() {
            if let Some(user) = room.users.get(&session_id) {
                tracing::info!("Removing socket_id {session_id} from room {file_id}");

                self.leave_room(room.file_id, &user.session_id).await?;
                affected_rooms.push(file_id.to_owned());
            }
        }

        tracing::info!("Removing socket_id {}", session_id);

        self.sockets.lock().await.remove(&socket_id);
        Ok(affected_rooms)
    }
}
