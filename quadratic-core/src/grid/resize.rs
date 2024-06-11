use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, Display, EnumString)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub enum Resize {
    Auto,
    Manual,
}

impl Default for Resize {
    fn default() -> Self {
        Self::Auto
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct ResizeMap {
    default: Resize,
    #[serde(with = "crate::util::btreemap_serde")]
    resize_map: BTreeMap<i64, Resize>,
}

impl ResizeMap {
    pub fn get_resize(&self, index: i64) -> Resize {
        *self.resize_map.get(&index).unwrap_or(&self.default)
    }

    pub fn set_resize(&mut self, index: i64, value: Resize) -> Resize {
        if value == self.default {
            self.resize_map.remove(&index)
        } else {
            self.resize_map.insert(index, value)
        }
        .unwrap_or(self.default)
    }

    pub fn reset(&mut self, index: i64) -> Resize {
        self.resize_map.remove(&index).unwrap_or(self.default)
    }

    pub fn iter_resize(&self) -> impl '_ + Iterator<Item = (i64, Resize)> {
        self.resize_map.iter().map(|(&k, &v)| (k, v))
    }
}
