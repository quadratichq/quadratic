use serde::{Deserialize, Serialize};

use super::{BorderStyleTimestampSchema, Contiguous2DSchema};

pub type BordersA1SideSchema = Contiguous2DSchema<Option<BorderStyleTimestampSchema>>;

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct BordersA1Schema {
    pub left: BordersA1SideSchema,
    pub right: BordersA1SideSchema,
    pub top: BordersA1SideSchema,
    pub bottom: BordersA1SideSchema,
}
