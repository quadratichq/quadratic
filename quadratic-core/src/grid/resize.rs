use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, Display, EnumString)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
#[derive(Default)]
pub enum Resize {
    #[default]
    Auto,
    Manual,
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

    pub fn into_iter_resize(self) -> impl Iterator<Item = (i64, Resize)> {
        self.resize_map.into_iter()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_behavior() {
        let resize_map = ResizeMap::default();
        assert_eq!(resize_map.get_resize(0), Resize::Auto);
        assert_eq!(resize_map.get_resize(100), Resize::Auto);
    }

    #[test]
    fn test_set_and_get_resize() {
        let mut resize_map = ResizeMap::default();

        // Set and get for a single index
        assert_eq!(resize_map.set_resize(0, Resize::Manual), Resize::Auto);
        assert_eq!(resize_map.get_resize(0), Resize::Manual);

        // Set and get for multiple indices
        assert_eq!(resize_map.set_resize(1, Resize::Manual), Resize::Auto);
        assert_eq!(resize_map.set_resize(2, Resize::Auto), Resize::Auto);
        assert_eq!(resize_map.get_resize(1), Resize::Manual);
        assert_eq!(resize_map.get_resize(2), Resize::Auto);
    }

    #[test]
    fn test_reset() {
        let mut resize_map = ResizeMap::default();

        // Set a value and then reset it
        resize_map.set_resize(0, Resize::Manual);
        assert_eq!(resize_map.reset(0), Resize::Manual);
        assert_eq!(resize_map.get_resize(0), Resize::Auto);

        // Reset a value that wasn't set (should return default)
        assert_eq!(resize_map.reset(1), Resize::Auto);
    }

    #[test]
    fn test_set_to_default() {
        let mut resize_map = ResizeMap::default();

        // Setting to non-default then back to default should remove the entry
        resize_map.set_resize(0, Resize::Manual);
        assert_eq!(resize_map.set_resize(0, Resize::Auto), Resize::Manual);
        assert_eq!(resize_map.get_resize(0), Resize::Auto);
        assert!(resize_map.iter_resize().next().is_none());
    }

    #[test]
    fn test_iter_resize() {
        let mut resize_map = ResizeMap::default();

        resize_map.set_resize(0, Resize::Manual);
        resize_map.set_resize(2, Resize::Manual);
        resize_map.set_resize(1, Resize::Auto); // This should not be stored

        let items: Vec<_> = resize_map.iter_resize().collect();
        assert_eq!(items, vec![(0, Resize::Manual), (2, Resize::Manual)]);
    }

    #[test]
    fn test_serde() {
        let mut resize_map = ResizeMap::default();
        resize_map.set_resize(0, Resize::Manual);
        resize_map.set_resize(2, Resize::Manual);

        let serialized = serde_json::to_string(&resize_map).unwrap();
        let deserialized: ResizeMap = serde_json::from_str(&serialized).unwrap();

        assert_eq!(resize_map, deserialized);
    }
}
