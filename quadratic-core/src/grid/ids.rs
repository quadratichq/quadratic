use core::fmt;
use core::fmt::Display;
use std::hash::Hash;
use std::str::FromStr;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

macro_rules! uuid_wrapper_struct {
    ($name:ident) => {
        #[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
        #[cfg_attr(feature = "js", wasm_bindgen, derive(ts_rs::TS))]
        pub struct $name {
            id: Uuid,
        }

        impl $name {
            pub(crate) fn new() -> Self {
                $name { id: Uuid::new_v4() }
            }
        }

        impl FromStr for $name {
            type Err = anyhow::Error;

            fn from_str(s: &str) -> Result<Self> {
                let id = Uuid::parse_str(s);
                Ok($name { id: id? })
            }
        }

        impl Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", self.id)
            }
        }
    };
}

uuid_wrapper_struct!(SheetId);
