use serde::{Deserialize, Serialize};

use super::{BorderStyleTimestampSchema, Contiguous2DSchema};

pub type BordersSideSchema = Contiguous2DSchema<Option<BorderStyleTimestampSchema>>;

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct BordersSchema {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub left: BordersSideSchema,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub right: BordersSideSchema,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub top: BordersSideSchema,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub bottom: BordersSideSchema,
}

impl BordersSchema {
    pub(crate) fn is_empty(&self) -> bool {
        self.left.is_empty()
            && self.right.is_empty()
            && self.top.is_empty()
            && self.bottom.is_empty()
    }
}
