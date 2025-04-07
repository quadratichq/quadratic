pub mod request;
pub mod response;

pub mod multiplayer {
    pub mod transaction {
        include!(concat!(env!("OUT_DIR"), "/multiplayer.rs"));
    }
}
