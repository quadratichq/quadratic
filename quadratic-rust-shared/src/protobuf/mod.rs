// include!(concat!(env!("OUT_DIR"), "protobuf.rs"));

pub mod utils;

pub mod quadratic {
    pub mod transaction {
        include!(concat!(env!("OUT_DIR"), "/quadratic.rs"));
    }
}

pub const FILE_DESCRIPTOR_SET: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/file_descriptor_set.bin"));

pub const FILE_DESCRIPTOR_SET_BYTES: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/file_descriptor_set.bin"));
// static DESCRIPTOR_POOL: Lazy<DescriptorPool> = Lazy::new(|| {
//     DescriptorPool::decode(
//         include_bytes!(concat!(env!("OUT_DIR"), "file_descriptor_set.bin")).as_ref(),
//     )
//     .unwrap()
// });

// Re-export the protobuf module
pub use prost::*;
