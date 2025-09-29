//! This is a wrapper around `Option<Option<T>>` that allows for a clear option.
//!
//! This is only necessary because serde will serialize Option<None> for
//! Option<Option<T>> as null in Contiguous2D.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub enum ClearOption<T> {
    Some(T),
    Clear,
}

impl<T> From<ClearOption<T>> for Option<T> {
    fn from(value: ClearOption<T>) -> Self {
        match value {
            ClearOption::Some(value) => Some(value),
            ClearOption::Clear => None,
        }
    }
}

impl<T> From<Option<T>> for ClearOption<T> {
    fn from(value: Option<T>) -> Self {
        match value {
            Some(value) => ClearOption::Some(value),
            None => ClearOption::Clear,
        }
    }
}

impl<T> ClearOption<T> {
    #[cfg(test)]
    pub(crate) fn unwrap(self) -> T {
        match self {
            ClearOption::Some(value) => value,
            ClearOption::Clear => panic!("ClearOption is Clear"),
        }
    }
}

impl<T: Clone> From<&Option<T>> for ClearOption<T> {
    fn from(opt: &Option<T>) -> Self {
        match opt {
            None => ClearOption::Clear,
            Some(v) => ClearOption::Some(v.clone()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_option() {
        // Test Some value
        let opt = Some(42);
        let clear_opt: ClearOption<i32> = opt.into();
        assert_eq!(clear_opt, ClearOption::Some(42));

        // Test None value
        let opt: Option<i32> = None;
        let clear_opt: ClearOption<i32> = opt.into();
        assert_eq!(clear_opt, ClearOption::Clear);
    }

    #[test]
    fn test_into_option() {
        // Test Some value
        let clear_opt = ClearOption::Some(42);
        let opt: Option<i32> = clear_opt.into();
        assert_eq!(opt, Some(42));

        // Test Clear value
        let clear_opt: ClearOption<i32> = ClearOption::Clear;
        let opt: Option<i32> = clear_opt.into();
        assert_eq!(opt, None);
    }

    #[test]
    fn test_unwrap() {
        // Test unwrapping Some value
        let clear_opt = ClearOption::Some(42);
        assert_eq!(clear_opt.unwrap(), 42);
    }

    #[test]
    #[should_panic(expected = "ClearOption is Clear")]
    fn test_unwrap_clear_panics() {
        // Test that unwrapping Clear panics
        let clear_opt: ClearOption<i32> = ClearOption::Clear;
        clear_opt.unwrap();
    }

    #[test]
    #[allow(clippy::clone_on_copy)]
    fn test_clone() {
        let clear_opt = ClearOption::Some(42);
        let cloned = clear_opt.clone();
        assert_eq!(clear_opt, cloned);

        let clear_opt: ClearOption<i32> = ClearOption::Clear;
        let cloned = clear_opt.clone();
        assert_eq!(clear_opt, cloned);
    }

    #[test]
    fn test_debug_format() {
        let clear_opt = ClearOption::Some(42);
        assert_eq!(format!("{clear_opt:?}"), "Some(42)");

        let clear_opt: ClearOption<i32> = ClearOption::Clear;
        assert_eq!(format!("{clear_opt:?}"), "Clear");
    }

    #[test]
    fn test_serde() {
        // Test serialization and deserialization of Some value
        let clear_opt = ClearOption::Some(42);
        let serialized = serde_json::to_string(&clear_opt).unwrap();
        let deserialized: ClearOption<i32> = serde_json::from_str(&serialized).unwrap();
        assert_eq!(clear_opt, deserialized);

        // Test serialization and deserialization of Clear value
        let clear_opt: ClearOption<i32> = ClearOption::Clear;
        let serialized = serde_json::to_string(&clear_opt).unwrap();
        let deserialized: ClearOption<i32> = serde_json::from_str(&serialized).unwrap();
        assert_eq!(clear_opt, deserialized);
    }
}
