use serde::{Deserialize, Serialize};

pub(crate) type Contiguous2DSchema<T> = Vec<BlockSchema<Vec<BlockSchema<T>>>>;

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub(crate) struct BlockSchema<T> {
    pub(crate) start: u64,
    pub(crate) end: u64,
    pub(crate) value: T,
}
