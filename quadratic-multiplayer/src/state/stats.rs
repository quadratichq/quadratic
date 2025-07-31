use serde::{Deserialize, Serialize};

use crate::state::State;

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
pub(crate) struct Stats {
    num_rooms: u64,
    num_users: u64,
    largest_room_size: u64,
}

impl State {
    pub(crate) async fn stats(&self) -> Stats {
        let rooms = self.rooms.lock().await;
        let num_rooms = rooms.len() as u64;
        let num_users: u64 = rooms.iter().map(|room| room.num_users()).sum();
        let largest_room_size = rooms.iter().map(|room| room.num_users()).max().unwrap_or(0);

        Stats {
            num_rooms,
            num_users,
            largest_room_size,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::test_util::setup;

    #[tokio::test]
    async fn test_stats() {
        let (_, state, _, _, _, _) = setup().await;
        let stats = state.stats().await;

        assert_eq!(stats.num_rooms, 1);
        assert_eq!(stats.num_users, 2);
        assert_eq!(stats.largest_room_size, 2);
    }
}
