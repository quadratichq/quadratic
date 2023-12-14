use anyhow::{anyhow, Result};
use uuid::Uuid;

use crate::state::State;

impl State {
    /// Retrieve the session_id from connections
    pub(crate) async fn get_session_id(&self, connection_id: Uuid) -> Result<Uuid> {
        let session_id = self
            .connections
            .lock()
            .await
            .get(&connection_id)
            .ok_or(anyhow!(
                "connection_id {} not found in sockets",
                connection_id
            ))?
            .to_owned();

        Ok(session_id)
    }

    /// Removes a connection from the state.  If the connection is in a room, leave the room.
    #[tracing::instrument]
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

#[cfg(test)]
mod tests {
    use crate::test_util::assert_anyhow_error;

    use super::*;

    async fn setup() -> (State, Uuid, Uuid) {
        let state = State::new();
        let session_id = Uuid::new_v4();
        let connection_id = Uuid::new_v4();

        state
            .connections
            .lock()
            .await
            .insert(connection_id, session_id);

        (state, session_id, connection_id)
    }

    #[tokio::test]
    async fn get_session_id() {
        let (state, session_id, connection_id) = setup().await;
        let result = state.get_session_id(connection_id).await.unwrap();

        assert_eq!(result, session_id);
    }

    #[tokio::test]
    async fn clear_connections() {
        let (state, _, connection_id) = setup().await;
        state.clear_connections(connection_id).await.unwrap();
        let result = state.get_session_id(connection_id).await;
        let expected = format!("connection_id {connection_id} not found in sockets");

        assert_anyhow_error(result, &expected);
    }
}
