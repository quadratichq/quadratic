use uuid::Uuid;

use crate::error::{MpError, Result};
use crate::state::State;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Connection {
    pub(crate) id: Uuid,
    pub(crate) session_id: Option<Uuid>,
    pub(crate) jwt: Option<String>,
}

impl Connection {
    pub(crate) fn new(session_id: Option<Uuid>, jwt: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            session_id,
            jwt,
        }
    }
}

impl State {
    /// Retrieve the connection from connections
    pub(crate) async fn get_connection(&self, connection_id: Uuid) -> Result<Connection> {
        let connection = self
            .connections
            .lock()
            .await
            .get(&connection_id)
            .cloned()
            .ok_or(MpError::Connection(format!(
                "connection_id {connection_id} not found in sockets"
            )))?;

        Ok(connection)
    }

    /// Removes a connection from the state.  If the connection is in a room, leave the room.
    #[tracing::instrument(level = "trace")]
    pub(crate) async fn clear_connections(&self, connection: &Connection) -> Result<Vec<Uuid>> {
        let connection_id = connection.id;
        let mut affected_rooms = vec![];

        for room in self.rooms.lock().await.iter() {
            let (file_id, room) = room.pair();
            let connection = self.get_connection(connection_id).await?;

            if let Some(session_id) = connection.session_id {
                if let Some(user) = room.users.get(&session_id) {
                    tracing::info!("Removing connection_id {connection_id} from room {file_id}");

                    self.leave_room(room.file_id, &user.session_id).await?;
                    affected_rooms.push(file_id.to_owned());
                }
            }
        }

        tracing::info!("Removing connection_id {}", connection_id);

        self.connections.lock().await.remove(&connection_id);
        Ok(affected_rooms)
    }
}

#[cfg(test)]
mod tests {
    use crate::{error::MpError, test_util::new_state};

    use super::*;

    async fn setup() -> (State, Uuid, Connection) {
        let state = new_state().await;
        let session_id = Uuid::new_v4();
        let connection = Connection::new(Some(session_id), None);

        state
            .connections
            .lock()
            .await
            .insert(connection.id, connection.clone());

        (state, session_id, connection)
    }

    #[tokio::test]
    async fn get_connection() {
        let (state, _, connection) = setup().await;
        let result = state.get_connection(connection.id).await.unwrap();

        assert_eq!(result, connection);
    }

    #[tokio::test]
    async fn clear_connections() {
        let (state, _, connection) = setup().await;
        let connection_id = connection.id;
        state.clear_connections(&connection).await.unwrap();
        let result = state.get_connection(connection_id).await;
        let expected = format!("connection_id {connection_id} not found in sockets");

        assert_eq!(result.unwrap_err(), MpError::Connection(expected));
    }
}
