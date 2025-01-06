use serde::{Deserialize, Serialize};

pub type Contiguous2DSchema<T> = Vec<BlockSchema<Vec<BlockSchema<T>>>>;

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct BlockSchema<T> {
    pub start: u64,
    pub end: u64,
    pub value: T,
}
