use std::{sync::Arc, time::Duration};
use tokio::{task::JoinHandle, time};
use uuid::Uuid;

use crate::{
    error::{MpError, Result},
    file::{new_client, process_queue_for_room},
    message::{broadcast, response::MessageResponse},
    state::{room::Room, settings::Settings, transaction_queue, State},
};

/// In a separate thread:
///   * Broadcast sequence number to all users in the room
///   * Check for stale users in rooms and remove them.
#[tracing::instrument(level = "trace")]
pub(crate) async fn start(state: Arc<State>, heartbeat_check_s: i64, heartbeat_timeout_s: i64) {
    let state = Arc::clone(&state);

    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(heartbeat_check_s as u64 * 1000));

        loop {
            // get a fresh copy of rooms for each iteration
            let rooms = state.rooms.lock().await.clone();

            for (file_id, room) in rooms.iter() {
                // process transaction queue for the room
                let transaction_queue = &state.transaction_queue;
                let processed = process_queue_for_room(
                    &state.settings.aws_client,
                    &state.settings.aws_s3_bucket_name,
                    transaction_queue,
                    &file_id,
                )
                .await;

                if let Err(error) = processed {
                    tracing::warn!("Error processing queue for room {file_id}: {:?}", error);
                }

                // broadcast sequence number to all users in the room
                if let Err(error) =
                    broadcast_sequence_num(Arc::clone(&state), file_id.to_owned()).await
                {
                    tracing::warn!("Error broadcasting sequence number: {:?}", error);
                }

                // remove stale users in the room
                if let Err(error) = remove_stale_users_in_room(
                    Arc::clone(&state),
                    file_id,
                    room,
                    heartbeat_timeout_s,
                )
                .await
                {
                    tracing::warn!(
                        "Error removing stale users from room {file_id}: {:?}",
                        error
                    );
                }
            }

            interval.tick().await;
        }
    });
}

// broadcast sequence number to all users in the room
async fn broadcast_sequence_num(state: Arc<State>, file_id: Uuid) -> Result<JoinHandle<()>> {
    let sequence_num = state
        .transaction_queue
        .lock()
        .await
        .get_sequence_num(file_id.to_owned())?;

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
    room: &Room,
    heartbeat_timeout_s: i64,
) -> Result<JoinHandle<()>> {
    let (num_removed, num_remaining) = state
        .remove_stale_users_in_room(file_id.to_owned(), heartbeat_timeout_s)
        .await?;

    tracing::info!("Checking heartbeats in room {file_id} ({num_remaining} remaining in room)");

    if num_removed > 0 {
        return Ok(broadcast(
            vec![],
            file_id.to_owned(),
            Arc::clone(&state),
            MessageResponse::from(room.to_owned()),
        ));
    }

    Err(MpError::BackgroundService(
        "Error removing stale users from room {file_id}".into(),
    ))
}

#[cfg(test)]
mod tests {
    use crate::test_util::{add_new_user_to_room, grid_setup, new_arc_state, operation};

    use super::*;

    #[tokio::test]
    async fn broadcast_sequence_num() {
        let state = new_arc_state().await;
        let file_id = Uuid::new_v4();
        let mut grid = grid_setup();
        let transaction_id_1 = Uuid::new_v4();
        let operations_1 = operation(&mut grid, 0, 0, "1");

        state.transaction_queue.lock().await.push_pending(
            transaction_id_1,
            file_id,
            vec![operations_1.clone()],
        );

        super::broadcast_sequence_num(state, file_id)
            .await
            .unwrap()
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn remove_stale_users_in_room() {
        let state = new_arc_state().await;
        let file_id = Uuid::new_v4();
        let connection_id = Uuid::new_v4();
        let user = add_new_user_to_room(file_id, state.clone(), connection_id).await;

        let room = state.get_room(&file_id).await.unwrap();
        assert_eq!(room.users.get(&user.session_id), Some(&user));

        super::remove_stale_users_in_room(state.clone(), &file_id, &room, -1)
            .await
            .unwrap()
            .await
            .unwrap();

        // user was removed from the room and the room was closed
        let room = state.get_room(&file_id).await;
        assert!(room.is_err());
    }
}
