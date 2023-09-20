use serde::{Serialize, Deserialize};
use std::num::ParseIntError;
use std::fmt::Write;

#[cfg(feature = "js")]
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg_attr(feature="js", wasm_bindgen, derive(ts_rs::TS))]
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub struct Rgb {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
}
#[cfg_attr(feature="js", wasm_bindgen)]
impl Rgb {
    #[cfg_attr(feature = "js", wasm_bindgen(constructor))]
    pub fn from_js(red: f64, green: f64, blue: f64) -> Self {
        Self {
            red: red.clamp(0.0f64, 255.0f64) as u8,
            green: green.clamp(0.0f64, 255.0f64) as u8,
            blue: blue.clamp(0.0f64, 255.0f64) as u8,
        }
    }
}
impl Rgb {
    pub fn from_str(color_str: &str) -> Result<Self, ParseIntError> { // TODO: serde
        assert_eq!(&color_str[0..=0], "#");
        Ok(Self {
            red: u8::from_str_radix(&color_str[1..=2], 16)?,
            green: u8::from_str_radix(&color_str[3..=4], 16)?,
            blue: u8::from_str_radix(&color_str[5..=6], 16)?,
        })
    }
    pub fn as_string(&self) -> String {
        let mut s = String::with_capacity(1 + 3 * 2);
        write!(&mut s, "#").unwrap();
        write!(&mut s, "{:02x}", self.red).unwrap();
        write!(&mut s, "{:02x}", self.green).unwrap();
        write!(&mut s, "{:02x}", self.blue).unwrap();
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_size() {
        // This is an important guarantee due to the number of instances
        assert_eq!(std::mem::size_of::<Rgb>(), 3);
    }

    #[test]
    fn test_from_str() {
        let maybe_color = Rgb::from_str("#224466");
        assert!(maybe_color.is_ok());

        let color = maybe_color.unwrap();
        assert_eq!(color.red, 0x22);
        assert_eq!(color.green, 0x44);
        assert_eq!(color.blue, 0x66);
    }
}
