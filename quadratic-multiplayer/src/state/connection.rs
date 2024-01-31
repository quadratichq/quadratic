use uuid::Uuid;

use crate::error::{MpError, Result};
use crate::state::State;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct PreConnection {
    pub(crate) id: Uuid,
    pub(crate) jwt: Option<String>,
}

impl PreConnection {
    pub(crate) fn new(jwt: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            jwt,
        }
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

#[macro_export]
macro_rules! get_mut_connection {
    ( $self:ident, $connection_id:ident ) => {
        $self
            .connections
            .lock()
            .await
            .get_mut(&$connection_id)
            .ok_or(MpError::Connection(format!(
                "connection_id {} not found",
                &$connection_id
            )))
    };
}

#[cfg(test)]
mod tests {
    use crate::{error::MpError, test_util::new_state};

    use super::*;

    async fn setup() -> (State, Uuid, Connection) {
        let state = new_state().await;
        let id = Uuid::new_v4();
        let session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let connection = Connection::new(id, session_id, file_id, None);

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
    async fn clears_connections() {
        let (state, _, connection) = setup().await;
        let connection_id = connection.id;
        state.remove_connection(&connection).await.unwrap();
        let result = state.get_connection(connection_id).await;
        let expected = format!("connection_id {connection_id} not found");

        assert_eq!(result.unwrap_err(), MpError::Connection(expected));
    }
}
