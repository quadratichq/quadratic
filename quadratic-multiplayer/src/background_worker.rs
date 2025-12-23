use rayon::prelude::*;
use std::{sync::Arc, time::Duration};
use tokio::{task::JoinHandle, time};
use uuid::Uuid;

use crate::{error::Result, get_room, message::broadcast, state::State};

const BACKGROUND_WORKER_INTERVAL_MS: u64 = 1000;

/// In a separate thread:
///   * Check for stale users in rooms and remove them.
#[tracing::instrument(level = "trace")]
pub(crate) fn start(
    state: Arc<State>,
    heartbeat_check_s: i64,
    heartbeat_timeout_s: i64,
) -> JoinHandle<()> {
    let state = Arc::clone(&state);

    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(BACKGROUND_WORKER_INTERVAL_MS));

        loop {
            // reconnect if pubsub connection is unhealthy
            state.pubsub.lock().await.reconnect_if_unhealthy().await;

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
        tracing::trace!("No users remaining in room {file_id}",);
        return Ok(None);
    }

    let message = get_room!(state, file_id)?.to_users_in_room_response(&state.settings.version);

    Ok(Some(broadcast(
        vec![],
        file_id.to_owned(),
        Arc::clone(&state),
        message,
    )))
}

#[cfg(test)]
mod tests {

    use crate::test_util::{add_new_user_to_room, new_arc_state};

    use super::*;

    #[tokio::test]
    async fn remove_stale_users_in_room() {
        let state = new_arc_state().await;
        let file_id = Uuid::new_v4();
        let user = add_new_user_to_room(file_id, state.clone(), 0).await;

        let room = state.get_room(&file_id).await.unwrap();
        assert_eq!(room.get_user(&user.session_id).unwrap(), user);

        let result = super::remove_stale_users_in_room(state.clone(), &file_id, -1).await;
        assert!(result.is_ok_and(|v| v.is_none()));

        // user was removed from the room and the room was closed
        let room = state.get_room(&file_id).await;
        assert!(room.is_err());
    }
}
