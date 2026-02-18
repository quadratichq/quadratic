//! General purpose utilities

pub mod array;

#[cfg(feature = "reqwest")]
pub mod http;

pub mod json;

#[cfg(feature = "zip")]
pub mod zip;
