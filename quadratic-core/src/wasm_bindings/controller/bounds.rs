use ts_rs::TS;
use wasm_bindgen::prelude::*;

use super::*;

#[derive(Serialize, Deserialize, Debug, TS)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct MinMax {
    pub min: i32,
    pub max: i32,
}
