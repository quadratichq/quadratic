use serde::{Deserialize, Serialize};

use super::{BorderStyleTimestampSchema, Contiguous2DSchema};

pub type BordersSideSchema = Contiguous2DSchema<Option<BorderStyleTimestampSchema>>;

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct BordersSchema {
    pub left: BordersSideSchema,
    pub right: BordersSideSchema,
    pub top: BordersSideSchema,
    pub bottom: BordersSideSchema,
}

impl BordersSchema {
    pub fn is_empty(&self) -> bool {
        self.left.is_empty()
            && self.right.is_empty()
            && self.top.is_empty()
            && self.bottom.is_empty()
    }
}
