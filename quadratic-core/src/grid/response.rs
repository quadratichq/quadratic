use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[must_use]
pub struct SetCellResponse<V> {
    pub old_value: V,
    pub html: bool,
    pub is_empty: bool,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[must_use]
pub struct GetIdResponse<I> {
    pub id: I,
    pub is_new: bool,
}
impl<I> GetIdResponse<I> {
    pub fn new(id: I) -> Self {
        Self { id, is_new: true }
    }
    pub fn old(id: I) -> Self {
        Self { id, is_new: false }
    }
}
