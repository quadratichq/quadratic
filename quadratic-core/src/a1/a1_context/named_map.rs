use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::{
    a1::{A1Error, A1Selection},
    util::case_fold_ascii,
};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct NamedMapEntry {
    name: String,
    selection: A1Selection,
}

impl NamedMapEntry {
    pub fn selection(&self) -> &A1Selection {
        &self.selection
    }
}

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct NamedMap {
    names: HashMap<String, NamedMapEntry>,
}

impl NamedMap {
    /// Inserts a named range into the map.
    pub fn insert(&mut self, name: String, selection: A1Selection) -> Result<(), A1Error> {
        if selection.contains_named_range() {
            return Err(A1Error::CircularNamedRange);
        }

        let name_folded = case_fold_ascii(&name);
        self.names
            .insert(name_folded, NamedMapEntry { name, selection });

        Ok(())
    }

    pub fn remove(&mut self, name: &str) {
        let name_folded = case_fold_ascii(name);
        self.names.remove(&name_folded);
    }

    /// Finds a table by name.
    pub fn try_named(&self, name: &str) -> Option<&NamedMapEntry> {
        let folded_name = case_fold_ascii(name);
        self.names.get(&folded_name)
    }

    /// Finds a table by name.
    pub fn try_named_mut(&mut self, table_name: &str) -> Option<&mut NamedMapEntry> {
        let folded_name = case_fold_ascii(table_name);
        self.names.get_mut(&folded_name)
    }

    /// Returns a list of all names in the map.
    pub fn names_ref(&self) -> Vec<&str> {
        self.names.values().map(|t| t.name.as_str()).collect()
    }

    /// Finds a named entry by selection
    pub fn named_from_selection(&self, selection: &A1Selection) -> Option<&NamedMapEntry> {
        self.names.iter().find_map(|(_, entry)| {
            if &entry.selection == selection {
                Some(entry)
            } else {
                None
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::a1::A1Context;

    use super::*;

    #[test]
    fn test_insert_and_lookup() {
        let mut map = NamedMap::default();
        let sel = A1Selection::test_a1("A1:B2");

        map.insert("MyRange".to_string(), sel.clone()).unwrap();

        let entry = map.try_named("myrange").unwrap(); // case-insensitive
        assert_eq!(entry.name, "MyRange");
        assert_eq!(entry.selection, sel);
    }

    #[test]
    fn test_insert_replaces_existing() {
        let mut map = NamedMap::default();
        let sel1 = A1Selection::test_a1("A1:B2");
        let sel2 = A1Selection::test_a1("C1:D2");

        map.insert("Test".to_string(), sel1.clone()).unwrap();
        map.insert("test".to_string(), sel2.clone()).unwrap(); // same folded name

        let entry = map.try_named("TEST").unwrap();
        assert_eq!(entry.selection, sel2); // should be updated
    }

    #[test]
    fn test_remove() {
        let mut map = NamedMap::default();
        let sel = A1Selection::test_a1("A1:B2");

        map.insert("Data".to_string(), sel).unwrap();
        assert!(map.try_named("data").is_some());

        map.remove("DATA");
        assert!(map.try_named("data").is_none());
    }

    #[test]
    fn test_names_list() {
        let mut map = NamedMap::default();
        map.insert("Foo".to_string(), A1Selection::test_a1("A1"))
            .unwrap();
        map.insert("Bar".to_string(), A1Selection::test_a1("B2"))
            .unwrap();

        let names = map.names_ref();
        assert_eq!(names.len(), 2);
        assert!(names.contains(&"Foo"));
        assert!(names.contains(&"Bar"));
    }

    #[test]
    fn test_named_from_selection() {
        let mut map = NamedMap::default();
        let sel = A1Selection::test_a1("Z1:Z2");

        map.insert("ZRange".to_string(), sel.clone()).unwrap();
        let found = map.named_from_selection(&sel);
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "ZRange");
    }

    #[test]
    fn test_circular_named_range() {
        let mut context = A1Context::default();
        context
            .named_map
            .insert("TEST".to_string(), A1Selection::test_a1("A1:B2"));

        let mut map = NamedMap::default();
        let circular_sel = A1Selection::test_a1_context("Test", &context); // simulate a named range referring to another

        let err = map.insert("Test".to_string(), circular_sel);
        assert!(matches!(err, Err(A1Error::CircularNamedRange)));
    }
}
