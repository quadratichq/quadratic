use tokio::sync::Mutex;
use uuid::Uuid;

struct Room {
    file_id: Uuid,
    users: Vec<Uuid>,
}

struct Rooms(Vec<Room>);

pub struct State {
    rooms: Mutex<Rooms>,
}

impl State {
    pub fn new() -> Self {
        State {
            rooms: Mutex::new(Rooms(vec![])),
        }
    }
}
