pub mod quadratic {
    pub mod transaction {
        include!(concat!(env!("OUT_DIR"), "/quadratic.rs"));
    }
}

// Re-export the protobuf module
pub use prost::*;
