use std::{sync::Arc, time::Duration};

use tokio::time;
use uuid::Uuid;

use crate::{
    message::{broadcast, response::MessageResponse},
    state::State,
};

/// In a separate thread:
///   * Broadcast sequence number to all users in the room
///   * Check for stale users in rooms and remove them.
pub(crate) async fn work(state: Arc<State>, heartbeat_check_s: i64, heartbeat_timeout_s: i64) {
    let state = Arc::clone(&state);

    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(heartbeat_check_s as u64 * 1000));

        loop {
            let rooms = state.rooms.lock().await.clone();

            for (file_id, room) in rooms.iter() {
                // broadcast sequence number to all users in the room
                let sequence_num = state
                    .transaction_queue
                    .lock()
                    .await
                    .get_sequence_num(file_id.to_owned());

                if let Ok(sequence_num) = sequence_num {
                    broadcast(
                        Uuid::new_v4(),
                        file_id.to_owned(),
                        Arc::clone(&state),
                        MessageResponse::CurrentTransaction { sequence_num },
                    );
                }

                // remove stale users in the room
                match state
                    .remove_stale_users_in_room(file_id.to_owned(), heartbeat_timeout_s)
                    .await
                {
                    Ok((num_removed, num_remaining)) => {
                        tracing::info!("Checking heartbeats in room {file_id} ({num_remaining} remaining in room)");

                        if num_removed > 0 {
                            broadcast(
                                // TODO(ddimaria): use a real session_id here
                                Uuid::new_v4(),
                                file_id.to_owned(),
                                Arc::clone(&state),
                                MessageResponse::from(room.to_owned()),
                            );
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Error removing stale users from room {file_id}: {:?}", e);
                    }
                }
            }

            interval.tick().await;
        }
    });
}
