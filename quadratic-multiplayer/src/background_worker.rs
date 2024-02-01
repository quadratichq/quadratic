use rayon::prelude::*;
use std::{sync::Arc, time::Duration};
use tokio::{task::JoinHandle, time};
use uuid::Uuid;

use crate::{
    error::Result,
    get_room,
    message::{broadcast, response::MessageResponse},
    state::State,
};

/// In a separate thread:
///   * Process transaction queue for the room
///   * Broadcast sequence number to all users in the room
///   * Check for stale users in rooms and remove them.
#[tracing::instrument(level = "trace")]
pub(crate) fn start(
    state: Arc<State>,
    heartbeat_check_s: i64,
    heartbeat_timeout_s: i64,
) -> JoinHandle<()> {
    let state = Arc::clone(&state);

    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(heartbeat_check_s as u64 * 1000));

        loop {
            // reconnect if pubsub connection is unhealthy
            state
                .transaction_queue
                .lock()
                .await
                .pubsub
                .reconnect_if_unhealthy()
                .await;

            // get all room ids
            let rooms = state
                .rooms
                .lock()
                .await
                .par_iter()
                .map(|room| (room.file_id.to_owned(), room.checkpoint_sequence_num))
                .collect::<Vec<_>>();

            let state = Arc::clone(&state);

            tokio::spawn(async move {
                // parallelize the work for each room
                for (file_id, _) in rooms.iter() {
                    tracing::trace!("Processing room {}", file_id);

                    // broadcast sequence number to all users in the room
                    let broadcasted = broadcast_sequence_num(Arc::clone(&state), file_id).await;

                    if let Err(error) = broadcasted {
                        tracing::warn!("Error broadcasting sequence number: {:?}", error);
                    }

                    // remove stale users in the room
                    let removed = remove_stale_users_in_room(
                        Arc::clone(&state),
                        file_id,
                        heartbeat_timeout_s,
                    )
                    .await;

                    if let Err(error) = removed {
                        tracing::warn!(
                            "Error removing stale users from room {}: {:?}",
                            file_id,
                            error
                        );
                    }
                }
            });

            interval.tick().await;
        }
    })
}

// broadcast sequence number to all users in the room
async fn broadcast_sequence_num(state: Arc<State>, file_id: &Uuid) -> Result<JoinHandle<()>> {
    let sequence_num = state.get_sequence_num(file_id).await?;

    Ok(broadcast(
        vec![],
        file_id.to_owned(),
        Arc::clone(&state),
        MessageResponse::CurrentTransaction { sequence_num },
    ))
}

// remove stale users in the room
#[tracing::instrument(level = "trace")]
async fn remove_stale_users_in_room(
    state: Arc<State>,
    file_id: &Uuid,
    heartbeat_timeout_s: i64,
) -> Result<Option<JoinHandle<()>>> {
    let (num_stale_users, num_remaining) = state
        .remove_stale_users_in_room(file_id.to_owned(), heartbeat_timeout_s)
        .await?;

    tracing::trace!("Checking heartbeats in room {file_id} ({num_remaining} remaining in room)");

    if num_stale_users == 0 {
        return Ok(None);
    }

    if num_remaining == 0 {
        tracing::info!("No users remaining in room {file_id}",);
        return Ok(None);
    }

    let users = get_room!(state, file_id)?.users.to_owned();
    let message = MessageResponse::from(users);

    Ok(Some(broadcast(
        vec![],
        file_id.to_owned(),
        Arc::clone(&state),
        message,
    )))
}

#[cfg(test)]
mod tests {
    use quadratic_core::controller::GridController;

    use crate::test_util::{add_new_user_to_room, new_arc_state, operation};

    use super::*;

    #[tokio::test]
    async fn test_broadcast_sequence_num() {
        let state = new_arc_state().await;
        let file_id = Uuid::new_v4();
        let _user = add_new_user_to_room(file_id, state.clone()).await;
        let mut grid = GridController::test();
        let transaction_id_1 = Uuid::new_v4();
        let operations_1 = operation(&mut grid, 0, 0, "1");

        state
            .transaction_queue
            .lock()
            .await
            .push_pending(transaction_id_1, file_id, vec![operations_1.clone()], 1)
            .await;

        super::broadcast_sequence_num(state, &file_id)
            .await
            .unwrap()
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn remove_stale_users_in_room() {
        let state = new_arc_state().await;
        let file_id = Uuid::new_v4();
        let user = add_new_user_to_room(file_id, state.clone()).await;

        let room = state.get_room(&file_id).await.unwrap();
        assert_eq!(room.get_user(&user.session_id).unwrap(), user);

        let result = super::remove_stale_users_in_room(state.clone(), &file_id, -1).await;
        assert!(result.is_ok_and(|v| v.is_none()));

        // user was removed from the room and the room was closed
        let room = state.get_room(&file_id).await;
        assert!(room.is_err());
    }
}
