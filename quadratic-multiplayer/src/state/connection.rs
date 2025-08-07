use uuid::Uuid;

use crate::error::{MpError, Result};
use crate::state::State;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct PreConnection {
    pub(crate) id: Uuid,
    pub(crate) jwt: Option<String>,
    pub(crate) m2m_token: Option<String>,
}

impl PreConnection {
    pub(crate) fn new(jwt: Option<String>, m2m_token: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            jwt,
            m2m_token,
        }
    }

    /// Get the m2m token if it exists.
    pub(crate) fn get_m2m_token(&self) -> Option<String> {
        self.m2m_token.clone()
    }

    /// Check if the connection is an m2m connection.
    pub(crate) fn is_m2m(&self) -> bool {
        self.m2m_token.is_some()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Connection {
    pub(crate) id: Uuid,
    pub(crate) session_id: Uuid,
    pub(crate) file_id: Uuid,
    pub(crate) jwt: Option<String>,
}

impl Connection {
    pub(crate) fn new(id: Uuid, session_id: Uuid, file_id: Uuid, jwt: Option<String>) -> Self {
        Self {
            id,
            session_id,
            file_id,
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
                "connection_id {connection_id} not found"
            )))?;

        Ok(connection)
    }

    /// Removes a connection from the state.  If the connection is in a room, leave the room.
    #[tracing::instrument(level = "trace")]
    pub(crate) async fn remove_connection(&self, connection: &Connection) -> Result<Option<Uuid>> {
        let Connection {
            id,
            session_id,
            file_id,
            ..
        } = connection;

        let mut removed_from_room = None;

        tracing::info!("Removing connection_id {id} from room {file_id}");

        if let Err(error) = self.leave_room(*file_id, session_id).await {
            tracing::warn!(
                "Error removing connection_id {id} from room {file_id}: {:?}",
                error
            );
        } else {
            removed_from_room = Some(*file_id);
        }

        self.connections.lock().await.remove(id);
        Ok(removed_from_room)
    }
}

#[cfg(test)]
mod tests {
    use crate::{error::MpError, test_util::setup};

    #[tokio::test]
    async fn get_connection() {
        let (_, state, connection_id, _, _, _) = setup().await;
        println!("state: {:?}", state.connections.lock().await);
        let result = state.get_connection(connection_id).await.unwrap();

        assert_eq!(result.id, connection_id);
    }

    #[tokio::test]
    async fn clears_connections() {
        let (_, state, connection_id, _, _, _) = setup().await;
        let connection = state.get_connection(connection_id).await.unwrap();

        state.remove_connection(&connection).await.unwrap();
        let result = state.get_connection(connection_id).await;
        let expected = format!("connection_id {connection_id} not found");

        assert_eq!(result.unwrap_err(), MpError::Connection(expected));
    }
}
